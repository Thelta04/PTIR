from collections import Counter
from datetime import datetime, timedelta, timezone
from ipaddress import ip_address
from threading import Lock
from time import time
from urllib.parse import urlparse

from locust import HttpUser, between, events, task


served_by_counts = Counter()
served_by_lock = Lock()
user_counter = Counter()
user_counter_lock = Lock()
shift_lock = Lock()
shared_shift = {"id": None}
invoice_lock = Lock()


DRIVER_EMAIL = "joao@email.com"
DRIVER_PASSWORD = "Joao123"

TRIP_PAYLOAD = {
    "originAddress": "Marques de Pombal, Lisboa",
    "destAddress": "Saldanha, Lisboa",
    # Non-numeric coords avoid external route-provider calls during load tests.
    "originCoords": "load-test-origin",
    "destCoords": "load-test-destination",
    "comfort_level": "basic",
    "num_passengers": 2,
}


@events.request.add_listener
def record_served_by(request_type, name, response_time, response_length, response=None, exception=None, **kwargs):
    if response is None:
        return

    served_by = response.headers.get("X-Served-By")
    if served_by:
        with served_by_lock:
            served_by_counts[served_by] += 1


@events.quitting.add_listener
def print_test_summary(environment, **kwargs):
    stats = environment.stats.total
    requested_users = getattr(environment.parsed_options, "num_users", "N/A")
    failure_rate = 0
    if stats.num_requests:
        failure_rate = (stats.num_failures / stats.num_requests) * 100

    print("\nTuxy load-test summary")
    print("----------------------")
    print("1) Tempo de resposta do sistema")
    print(f"   Average response time: {stats.avg_response_time:.2f} ms")
    print(f"   Median response time: {stats.median_response_time:.2f} ms")
    print(f"   95th percentile: {stats.get_response_time_percentile(0.95):.2f} ms")
    print(f"   Max response time: {stats.max_response_time:.2f} ms")
    print(f"   Requests/s: {stats.total_rps:.2f}")

    print("\n2) Capacidade para múltiplos clientes")
    print(f"   Users configured: {requested_users}")
    print(f"   Total requests: {stats.num_requests}")
    print(f"   Total failures: {stats.num_failures}")
    print(f"   Failure rate: {failure_rate:.2f}%")

    print("\n3) Comportamento do balanceamento de carga")
    if not served_by_counts:
        print("   No X-Served-By headers were captured.")
    else:
        total = sum(served_by_counts.values())
        for server, count in served_by_counts.most_common():
            percentage = (count / total) * 100
            print(f"   {server}: {count} requests ({percentage:.1f}%)")

    print("\n4) Fluxo da viagem por ordem")
    for index, (method, name, description) in enumerate(FLOW_STEPS, start=1):
        stat = environment.stats.get(name, method)
        if not stat or stat.num_requests == 0:
            print(f"   {index:02d}. {description}: not called")
            continue

        p95 = stat.get_response_time_percentile(0.95) if stat.num_requests else 0
        print(
            f"   {index:02d}. {description}: "
            f"{stat.num_requests} req, {stat.num_failures} fail, "
            f"avg {stat.avg_response_time:.2f} ms, p95 {p95:.2f} ms"
        )


class TuxyLoadUser(HttpUser):
    wait_time = between(0.1, 0.6)

    #coisas q começam ! 
    def on_start(self):
        parsed_host = urlparse(self.host)
        if parsed_host.scheme == "https":
            try:
                ip_address(parsed_host.hostname or "")
                # The TLS certificate is issued for the domain, not the raw public IP.
                self.client.verify = False
            except ValueError:
                self.client.verify = True

        self.client_email = None
        self.client_password = "Load123"
        self.client_id = None
        self.client_headers = {}
        self.driver_headers = {}
        self.driver_id = None
        self.active_shift_id = None

        self._create_unique_client()
        self._login_driver()
        self._ensure_active_shift()

    def _next_user_index(self):
        with user_counter_lock:
            user_counter["load_users"] += 1
            return user_counter["load_users"]

    def _create_unique_client(self):
        index = self._next_user_index()
        timestamp = int(time() * 1000)
        self.client_email = f"load-client-{timestamp}-{index}@email.com"
        nif = f"1{(timestamp + index) % 100000000:08d}"

        payload = {
            "nif": nif,
            "name": f"Load Client {index}",
            "email": self.client_email,
            "gender": "Other",
            "password": self.client_password,
        }

        with self.client.post(
            "/api/auth/create/client/",
            json=payload,
            name="POST /api/auth/create/client/",
            catch_response=True,
        ) as response:
            if response.status_code != 201:
                response.failure(
                    f"Could not create load-test client: status={response.status_code} body={response.text}"
                )

    def _login(self, email, password, name):
        with self.client.post(
            "/api/auth/login/",
            json={"email": email, "password": password},
            name=name,
            catch_response=True,
        ) as response:
            if response.status_code != 200:
                response.failure(f"Login failed: status={response.status_code} body={response.text}")
                return None

            data = response.json()
            access = data.get("access")
            if not access:
                response.failure("Login response did not include an access token.")
                return None

            return {
                "id": data.get("id"),
                "headers": {"Authorization": f"Bearer {access}"},
            }

    def _login_client(self):
        session = self._login(
            self.client_email,
            self.client_password,
            "POST /api/auth/login/ client",
        )
        if not session:
            return False

        self.client_id = session["id"]
        self.client_headers = session["headers"]
        return True

    def _login_driver(self):
        session = self._login(
            DRIVER_EMAIL,
            DRIVER_PASSWORD,
            "POST /api/auth/login/ driver",
        )
        if session:
            self.driver_id = session["id"]
            self.driver_headers = session["headers"]

    def _ensure_active_shift(self):
        if not self.driver_id:
            return

        with shift_lock:
            if shared_shift["id"]:
                self.active_shift_id = shared_shift["id"]
                return

            shift_id = self._find_active_or_startable_shift()
            if shift_id:
                shared_shift["id"] = shift_id
                self.active_shift_id = shift_id
                return

            shift_id = self._create_and_start_shift()
            if shift_id:
                shared_shift["id"] = shift_id
                self.active_shift_id = shift_id

    def _find_active_or_startable_shift(self):
        with self.client.get(
            f"/api/shift/get/{self.driver_id}/",
            headers=self.driver_headers,
            name="GET /api/shift/get/:driver_id/",
            catch_response=True,
        ) as response:
            if response.status_code != 200:
                response.failure(
                    f"Could not list driver shifts: status={response.status_code} body={response.text}"
                )
                return None

            shifts = response.json()
            active_shift = next(
                (
                    shift
                    for shift in shifts
                    if shift.get("real_interval")
                    and shift["real_interval"].get("start_time")
                    and not shift["real_interval"].get("end_time")
                ),
                None,
            )
            if active_shift:
                return active_shift["id"]

            unstarted_shift = next(
                (shift for shift in shifts if not shift.get("real_interval")),
                None,
            )
            if not unstarted_shift:
                return None

        return self._start_shift(unstarted_shift["id"])

    def _create_and_start_shift(self):
        taxi_plate = self._get_available_taxi_plate()
        if not taxi_plate:
            return None

        start_time = datetime.now(timezone.utc)
        end_time = start_time + timedelta(hours=7)
        payload = {
            "driver_id": self.driver_id,
            "taxi_license_plate": taxi_plate,
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
        }

        with self.client.post(
            "/api/shift/create/",
            json=payload,
            headers=self.driver_headers,
            name="POST /api/shift/create/",
            catch_response=True,
        ) as response:
            if response.status_code != 201:
                response.failure(f"Could not create shift: status={response.status_code} body={response.text}")
                return None

            shift_id = response.json().get("shift_id")
            if not shift_id:
                response.failure("Shift creation response did not include shift_id.")
                return None

        return self._start_shift(shift_id)

    def _get_available_taxi_plate(self):
        with self.client.get(
            "/api/taxi/",
            headers=self.driver_headers,
            name="GET /api/taxi/",
            catch_response=True,
        ) as response:
            if response.status_code != 200:
                response.failure(f"Could not list taxis: status={response.status_code} body={response.text}")
                return None

            taxis = response.json()
            taxi = next(
                (
                    taxi
                    for taxi in taxis
                    if taxi.get("comfort_level") == TRIP_PAYLOAD["comfort_level"]
                    and taxi.get("num_passengers", 0) >= TRIP_PAYLOAD["num_passengers"]
                ),
                taxis[0] if taxis else None,
            )
            if not taxi:
                response.failure("No taxi available to create a shift.")
                return None

            return taxi["license_plate"]

    def _start_shift(self, shift_id):
        with self.client.patch(
            f"/api/shift/{shift_id}/start",
            headers=self.driver_headers,
            name="PATCH /api/shift/:id/start",
            catch_response=True,
        ) as response:
            if response.status_code == 400 and "already started" in response.text:
                return shift_id

            if response.status_code != 200:
                response.failure(f"Could not start shift: status={response.status_code} body={response.text}")
                return None

            return shift_id

    def _request(self, method, url, name, expected_status, **kwargs):
        with method(url, name=name, catch_response=True, **kwargs) as response:
            if response.status_code != expected_status:
                response.failure(f"Expected {expected_status}, got {response.status_code}: {response.text}")
                return None
            return response.json() if response.text else {}

    @task
    def create_and_complete_trip(self):
        if not self.active_shift_id:
            self.environment.events.request.fire(
                request_type="SETUP",
                name="active driver shift",
                response_time=0,
                response_length=0,
                exception=Exception("No active, startable, or creatable driver shift was found."),
            )
            return

        if not self._login_client():
            return

        self._request(
            self.client.get,
            "/api/check/",
            "GET /api/check/",
            200,
        )

        trip_payload = {
            **TRIP_PAYLOAD,
            "client_id": self.client_id,
        }
        trip = self._request(
            self.client.post,
            "/api/trip/create/",
            "POST /api/trip/create/",
            201,
            json=trip_payload,
            headers=self.client_headers,
        )
        if not trip:
            return

        trip_id = trip["id"]

        self._request(
            self.client.get,
            "/api/trip/?status=PENDING",
            "GET /api/trip/ pending",
            200,
            headers=self.driver_headers,
        )

        if not self._request(
            self.client.patch,
            f"/api/trip/{trip_id}/accept/",
            "PATCH /api/trip/:id/accept/",
            200,
            json={"shift_id": self.active_shift_id},
            headers=self.driver_headers,
        ):
            return

        if not self._request(
            self.client.patch,
            f"/api/trip/{trip_id}/client-accept/",
            "PATCH /api/trip/:id/client-accept/",
            200,
            headers=self.client_headers,
        ):
            return

        if not self._request(
            self.client.patch,
            f"/api/trip/{trip_id}/pickup/",
            "PATCH /api/trip/:id/pickup/",
            200,
            headers=self.driver_headers,
        ):
            return

        if not self._request(
            self.client.patch,
            f"/api/trip/{trip_id}/complete/",
            "PATCH /api/trip/:id/complete/",
            200,
            headers=self.driver_headers,
        ):
            return

        if not self._request(
            self.client.patch,
            f"/api/trip/{trip_id}/pay-mock/",
            "PATCH /api/trip/:id/pay-mock/",
            200,
            headers=self.client_headers,
        ):
            return

        self._request(
            self.client.get,
            "/api/pricing/",
            "GET /api/pricing/",
            200,
            headers=self.client_headers,
        )

        with invoice_lock:
            if not self._request(
                self.client.patch,
                f"/api/trip/{trip_id}/emit-invoice/",
                "PATCH /api/trip/:id/emit-invoice/",
                200,
                headers=self.driver_headers,
            ):
                return

        self._request(
            self.client.post,
            "/api/rating/create/",
            "POST /api/rating/create/",
            201,
            json={"trip_id": trip_id, "score": 5},
            headers=self.client_headers,
        )
