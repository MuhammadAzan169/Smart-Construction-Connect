#!/usr/bin/env python3
"""
Smart Construction Connect — LOCAL application runner.

One command starts the whole product on your machine:

    python app.py

It will
  1. install the backend requirements *plus* the local-only ML extras
     (sentence-transformers, faiss-cpu, easyocr) into the Python interpreter
     you launched it with, so semantic search and OCR run fully offline with
     local models,
  2. install the frontend npm packages (first run only),
  3. start the FastAPI backend on :8000 and the Vite dev server on :8080,
  4. open the browser and stream both logs into this one terminal,
  5. shut both down cleanly on Ctrl+C.

No virtual environment is created: packages go into whatever Python runs this
file. If you want them isolated, activate your own venv first and run
`python app.py` from inside it.

Nothing here is used in production: Render runs `backend/app.py` on its own and
Vercel builds `frontend/` on its own. This file exists purely so that a local
checkout is a single-command, fully-featured application.

Useful flags
    --skip-install      don't touch pip/npm (fastest restart)
    --skip-local-ml     don't install torch/faiss/easyocr (light install, uses
                        the same API-based path as Render)
    --api-embeddings    run with EMBEDDINGS_API_* instead of local SBERT
    --backend-only      start only the API
    --frontend-only     start only the SPA
    --no-browser        don't open a browser tab
    --backend-port N    default 8000
    --frontend-port N   default 8080
"""

from __future__ import annotations

import argparse
import os
import platform
import shutil
import signal
import socket
import subprocess
import sys
import threading
import time
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND_DIR = ROOT / "backend"
FRONTEND_DIR = ROOT / "frontend"

IS_WINDOWS = platform.system() == "Windows"

# Windows consoles (and any redirected stdout) default to cp1252, which cannot
# encode the arrows/box-drawing characters both servers log. Without this the
# log-pump threads die with UnicodeEncodeError and you lose all child output.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except (AttributeError, ValueError):
        pass

# ── tiny ANSI helpers (no dependency needed) ─────────────────────────────────
_COLOR = sys.stdout.isatty() and os.getenv("NO_COLOR") is None


def _c(text: str, code: str) -> str:
    return f"\033[{code}m{text}\033[0m" if _COLOR else text


def info(msg: str) -> None:
    print(f"{_c('[runner]', '36')} {msg}", flush=True)


def warn(msg: str) -> None:
    print(f"{_c('[runner]', '33')} {msg}", flush=True)


def fail(msg: str) -> None:
    print(f"{_c('[runner]', '31')} {msg}", flush=True)


# ── dependency installation ───────────────────────────────────────────

def pip_install(py: Path, req: Path, label: str) -> bool:
    info(f"installing {label} ({req.name})…")
    proc = subprocess.run([str(py), "-m", "pip", "install", "-r", str(req)])
    if proc.returncode != 0:
        warn(f"{label} install failed — continuing, but some features may be unavailable")
        return False
    return True


# ── npm handling ─────────────────────────────────────────────────────────────

def npm_cmd() -> str | None:
    for candidate in ("npm.cmd", "npm") if IS_WINDOWS else ("npm",):
        found = shutil.which(candidate)
        if found:
            return found
    return None


def ensure_frontend_deps(npm: str, skip_install: bool) -> None:
    if (FRONTEND_DIR / "node_modules").is_dir():
        if not skip_install:
            info("frontend dependencies already installed — skipping npm install")
        return
    if skip_install:
        warn("node_modules missing but --skip-install given; the dev server will fail")
        return
    info("installing frontend dependencies (npm install — this takes a few minutes)…")
    subprocess.check_call([npm, "install"], cwd=str(FRONTEND_DIR))


# ── env file bootstrapping ───────────────────────────────────────────────────

def ensure_env_files() -> None:
    """Copy .env.example → .env the first time, and give JWT_SECRET_KEY a real
    random value so local runs are never left on the insecure default."""
    be_env = BACKEND_DIR / ".env"
    if not be_env.exists() and (BACKEND_DIR / ".env.example").exists():
        import secrets

        text = (BACKEND_DIR / ".env.example").read_text(encoding="utf-8")
        text = text.replace(
            "JWT_SECRET_KEY=change-me-to-a-long-random-string",
            f"JWT_SECRET_KEY={secrets.token_hex(32)}",
        )
        be_env.write_text(text, encoding="utf-8")
        info("created backend/.env from .env.example (add your OPENROUTER_API_KEY1 there)")

    fe_env = FRONTEND_DIR / ".env"
    if not fe_env.exists():
        # Locally the Vite proxy handles everything; VITE_API_URL must stay unset
        # or the chat WebSocket would dial the deployed Render backend instead.
        fe_env.write_text(
            "# Local development: leave VITE_API_URL unset so Vite proxies to\n"
            "# the local backend on :8000. Set it only for Vercel deployments.\n"
            "# VITE_API_URL=https://your-backend.onrender.com\n",
            encoding="utf-8",
        )
        info("created frontend/.env for local development")


# ── ports ────────────────────────────────────────────────────────────────────

def port_in_use(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.4)
        return s.connect_ex(("127.0.0.1", port)) == 0


def wait_for_port(port: int, timeout: float = 90.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if port_in_use(port):
            return True
        time.sleep(0.4)
    return False


# ── child process plumbing ───────────────────────────────────────────────────

_processes: list[subprocess.Popen] = []


def stream_output(proc: subprocess.Popen, label: str, color: str) -> threading.Thread:
    tag = _c(f"[{label}]", color)

    def pump() -> None:
        assert proc.stdout is not None
        try:
            for line in proc.stdout:
                try:
                    print(f"{tag} {line.rstrip()}", flush=True)
                except UnicodeEncodeError:
                    safe = line.rstrip().encode("ascii", "replace").decode("ascii")
                    print(f"{tag} {safe}", flush=True)
        except (ValueError, OSError):
            pass  # stream closed during shutdown

    t = threading.Thread(target=pump, daemon=True)
    t.start()
    return t


def spawn(cmd: list[str], cwd: Path, env: dict[str, str], label: str, color: str) -> subprocess.Popen:
    creationflags = subprocess.CREATE_NEW_PROCESS_GROUP if IS_WINDOWS else 0
    proc = subprocess.Popen(
        cmd,
        cwd=str(cwd),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        encoding="utf-8",
        errors="replace",
        creationflags=creationflags,
        start_new_session=not IS_WINDOWS,
    )
    _processes.append(proc)
    stream_output(proc, label, color)
    return proc


def shutdown() -> None:
    for proc in _processes:
        if proc.poll() is not None:
            continue
        try:
            if IS_WINDOWS:
                proc.send_signal(signal.CTRL_BREAK_EVENT)
            else:
                os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
        except Exception:
            proc.terminate()
    deadline = time.time() + 8
    for proc in _processes:
        try:
            proc.wait(timeout=max(0.1, deadline - time.time()))
        except Exception:
            proc.kill()


# ── main ─────────────────────────────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser(description="Run Smart Construction Connect locally")
    parser.add_argument("--skip-install", action="store_true", help="skip pip/npm installs")
    parser.add_argument("--skip-local-ml", action="store_true",
                        help="do not install the local ML extras (torch/faiss/easyocr)")
    parser.add_argument("--api-embeddings", action="store_true",
                        help="use the EMBEDDINGS_API_* provider instead of local SBERT")
    parser.add_argument("--backend-only", action="store_true")
    parser.add_argument("--frontend-only", action="store_true")
    parser.add_argument("--no-browser", action="store_true")
    parser.add_argument("--backend-port", type=int, default=int(os.getenv("BACKEND_PORT", "8000")))
    parser.add_argument("--frontend-port", type=int, default=int(os.getenv("FRONTEND_PORT", "8080")))
    args = parser.parse_args()

    run_backend = not args.frontend_only
    run_frontend = not args.backend_only

    if not BACKEND_DIR.is_dir() or not FRONTEND_DIR.is_dir():
        fail("expected ./backend and ./frontend next to this file — run app.py from the repo root")
        return 1

    print()
    info(_c("Smart Construction Connect — local development runner", "1"))
    print()

    ensure_env_files()

    # ── Python side ── (installs into the interpreter running this file)
    py = Path(sys.executable)
    if run_backend:
        info(f"using Python {sys.version.split()[0]} at {py}")
        if not args.skip_install:
            pip_install(py, BACKEND_DIR / "requirements.txt", "backend dependencies")
            local_req = BACKEND_DIR / "requirements-local.txt"
            if args.skip_local_ml:
                info("skipping local ML extras (--skip-local-ml)")
            elif local_req.exists():
                pip_install(py, local_req, "local ML extras (SBERT + FAISS + OCR)")

    # ── Node side ──
    npm = npm_cmd() if run_frontend else None
    if run_frontend and npm is None:
        fail("npm was not found on PATH. Install Node.js 18+ from https://nodejs.org")
        return 1
    if run_frontend:
        ensure_frontend_deps(npm, args.skip_install)

    # ── ports ──
    if run_backend and port_in_use(args.backend_port):
        fail(f"port {args.backend_port} is already in use — stop the other process "
             f"or pass --backend-port")
        return 1
    if run_frontend and port_in_use(args.frontend_port):
        fail(f"port {args.frontend_port} is already in use — stop the other process "
             f"or pass --frontend-port")
        return 1

    # ── environment for the children ──
    base_env = os.environ.copy()
    base_env.setdefault("PYTHONUNBUFFERED", "1")
    base_env.setdefault("PYTHONIOENCODING", "utf-8")

    backend_env = base_env.copy()
    backend_env["ENV"] = "development"
    backend_env["PORT"] = str(args.backend_port)
    backend_env["PORTS"] = str(args.backend_port)
    # Local runs use the *local* embedding model by default — that is the whole
    # point of running locally. --api-embeddings switches to the Render path.
    if args.api_embeddings or args.skip_local_ml:
        backend_env["ENABLE_LOCAL_SBERT"] = "0"
    else:
        backend_env.setdefault("ENABLE_LOCAL_SBERT", "1")
    # Make sure the browser origin is allowed even on a custom frontend port.
    extra_origins = ",".join(
        f"http://{h}:{args.frontend_port}" for h in ("localhost", "127.0.0.1")
    )
    existing = backend_env.get("CORS_ORIGINS", "")
    backend_env["CORS_ORIGINS"] = f"{existing},{extra_origins}".strip(",") if existing else extra_origins

    frontend_env = base_env.copy()
    # Never let a deployed backend URL leak into the local dev server.
    frontend_env.pop("VITE_API_URL", None)
    # Point the Vite dev proxy at the backend we actually started, so a custom
    # --backend-port keeps /api, /uploads and /company_data working.
    frontend_env["DEV_API_TARGET"] = f"http://localhost:{args.backend_port}"

    try:
        if run_backend:
            mode = "API embeddings" if backend_env["ENABLE_LOCAL_SBERT"] == "0" else "local SBERT model"
            info(f"starting backend on http://localhost:{args.backend_port}  ({mode})")
            spawn(
                [str(py), "-m", "uvicorn", "app:app",
                 "--host", "0.0.0.0", "--port", str(args.backend_port)],
                BACKEND_DIR, backend_env, "backend", "35",
            )
            if not wait_for_port(args.backend_port):
                fail("backend did not come up — see the [backend] log above")
                shutdown()
                return 1
            info(f"backend ready — API docs at http://localhost:{args.backend_port}/docs")

        if run_frontend:
            info(f"starting frontend on http://localhost:{args.frontend_port}")
            spawn(
                [npm, "run", "dev", "--", "--port", str(args.frontend_port), "--strictPort"],
                FRONTEND_DIR, frontend_env, "frontend", "32",
            )
            if wait_for_port(args.frontend_port):
                url = f"http://localhost:{args.frontend_port}"
                print()
                info(_c(f"Smart Construction Connect is running → {url}", "1;32"))
                print()
                if not args.no_browser:
                    threading.Timer(1.0, lambda: webbrowser.open(url)).start()
            else:
                warn("frontend did not report ready in time — check the [frontend] log")

        info("press Ctrl+C to stop everything")

        # Wait until any child exits (or the user interrupts).
        while True:
            for proc in _processes:
                code = proc.poll()
                if code is not None:
                    warn(f"a child process exited with code {code} — shutting down")
                    shutdown()
                    return code or 0
            time.sleep(0.5)

    except KeyboardInterrupt:
        print()
        info("stopping…")
        shutdown()
        info("all processes stopped. Bye!")
        return 0
    except Exception as exc:  # noqa: BLE001
        fail(f"unexpected error: {exc}")
        shutdown()
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
