# Container Management

AutoFlow acts as a complete visual interface for the container engine running on your remote virtual private servers. You do not need to log into your server via SSH to manage your application containers.

---

## Viewing Containers

The AutoFlow Desktop Dashboard provides a real-time list of all active and stopped containers running on the selected remote server.
- The interface displays the container ID, image name, bound ports, and current status (Running, Stopped, Restarting, Dead).
- From the CLI, use `autoflow container list` to output a formatted table of container states.

## Lifecycle Controls

You can control container lifecycles directly from the interface:
- **Start:** Boots a stopped container.
- **Stop:** Sends a `SIGTERM` signal to gracefully shut down the application.
- **Restart:** Performs a stop and start sequence, useful for clearing memory leaks or forcing application reloads.
- **Delete:** Permanently destroys the container. Note: If persistent volumes are mapped, the underlying data on the host disk is *not* deleted.

## Live Metrics & Resource Usage

AutoFlow streams live telemetry data from the remote Docker daemon back to your desktop.
- For each container, you can view real-time **CPU Utilization** and **RAM Consumption**.
- This is critical for identifying memory leaks within specific applications without relying on heavy third-party monitoring agents.

## Live Logs

AutoFlow streams standard output (`stdout`) and standard error (`stderr`) directly from the remote container to the Desktop interface.
- **Log Sanitization:** Before logs are displayed, AutoFlow's custom sanitization engine scans the stream buffers. Any strings matching the signatures of credentials, access tokens, or SSH keys are replaced with security indicators (e.g., `[REDACTED]`), preventing accidental exposure on your screen.

## Terminal Access

For advanced troubleshooting, AutoFlow provides direct virtual terminal access.
- Clicking **Open Terminal** on a container in the Desktop App opens an interactive SSH shell directly *inside* the running container on the remote host.
- From the CLI, you can use `autoflow container exec <container-id> /bin/sh`.
- This allows you to inspect local file systems, run database migrations, or test internal network connections without manually configuring SSH proxy commands.
