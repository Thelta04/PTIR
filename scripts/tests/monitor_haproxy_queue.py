import argparse
import csv
import time
from io import StringIO

import requests


def fetch_haproxy_rows(stats_url):
    response = requests.get(stats_url, timeout=2)
    response.raise_for_status()

    text = response.text.lstrip("# ")
    return list(csv.DictReader(StringIO(text)))


def server_rows(rows, backend_name):
    for row in rows:
        if row.get("pxname") == backend_name and row.get("svname") not in ("BACKEND", "FRONTEND"):
            yield row


def main():
    parser = argparse.ArgumentParser(description="Monitor HAProxy request queue length for NFR-02.")
    parser.add_argument("--stats-url", required=True, help="HAProxy CSV stats URL, e.g. http://lb:8404/;csv")
    parser.add_argument("--backend", default="webapp_servers", help="HAProxy backend name to monitor")
    parser.add_argument("--threshold", type=int, default=50, help="Maximum allowed queue length per app server")
    parser.add_argument("--hold-seconds", type=int, default=5, help="How long the threshold may be exceeded before failing")
    parser.add_argument("--interval", type=float, default=1.0, help="Polling interval in seconds")
    parser.add_argument("--duration", type=int, default=120, help="Total monitor duration in seconds")
    args = parser.parse_args()

    exceeded_since = {}
    deadline = time.time() + args.duration
    failed = False

    print(
        f"Monitoring HAProxy backend '{args.backend}' from {args.stats_url} "
        f"for {args.duration}s. Threshold: qcur <= {args.threshold}."
    )

    while time.time() < deadline:
        rows = fetch_haproxy_rows(args.stats_url)
        now = time.time()

        for row in server_rows(rows, args.backend):
            server = row["svname"]
            qcur = int(row.get("qcur") or 0)
            scur = int(row.get("scur") or 0)

            print(f"{time.strftime('%H:%M:%S')} server={server} qcur={qcur} scur={scur}")

            if qcur > args.threshold:
                exceeded_since.setdefault(server, now)
                exceeded_for = now - exceeded_since[server]
                if exceeded_for >= args.hold_seconds:
                    print(
                        f"NFR-02 FAIL: {server} queue length was {qcur}, "
                        f"above {args.threshold} for {exceeded_for:.1f}s."
                    )
                    failed = True
            else:
                exceeded_since.pop(server, None)

        if failed:
            raise SystemExit(1)

        time.sleep(args.interval)

    print("NFR-02 PASS: no app server exceeded the queue threshold for the configured duration.")


if __name__ == "__main__":
    main()
