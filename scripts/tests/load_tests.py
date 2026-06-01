from locust import HttpUser, between, task


class TuxyLoadUser(HttpUser):
    wait_time = between(0.1, 0.6)

    @task(4)
    def list_trips(self):
        self.client.get("/api/trip/", name="GET /api/trip/")

    @task(3)
    def list_taxis(self):
        self.client.get("/api/taxi/", name="GET /api/taxi/")

    @task(3)
    def list_drivers(self):
        self.client.get("/api/driver/", name="GET /api/driver/")

    @task(2)
    def list_clients(self):
        self.client.get("/api/client/", name="GET /api/client/")

    @task(2)
    def health_check(self):
        self.client.get("/api/check/", name="GET /api/check/")

    @task(1)
    def pricing(self):
        self.client.get("/api/pricing/", name="GET /api/pricing/")
                                                                                                                                                                                                                                                                 