# System Monitoring & Telemetry

AutoFlow includes a built-in, lightweight telemetry subservice. Unlike traditional monitoring tools (like Datadog or New Relic) that require you to install heavy, persistent agents on your server, AutoFlow streams data natively over your active SSH connection.

---

## Real-Time Updates

When the AutoFlow Desktop Application is open and focused on the Dashboard, it establishes a multiplexed SSH connection to your target server. It polls the server every few seconds to retrieve system diagnostics, displaying them visually without relying on third-party metric collectors.

### CPU & RAM
- **Processor Load:** Displays real-time CPU utilization across all cores.
- **Physical Memory:** Tracks active RAM consumption. If RAM usage spikes to critical levels during a deployment, AutoFlow automatically provisions Virtual Swap.

### Disk Space
- Tracks available solid-state drive (SSD) space.
- AutoFlow triggers a warning indicator if available space drops below 20%. This is critical because container build caches and image layers can quickly fill small VPS disks.

### Network & Health Status
- AutoFlow actively pings the Nginx reverse proxy to ensure the server is accepting web traffic.
- Tracks container uptime and restarts. If a container repeatedly crashes and enters a `restarting` loop, the dashboard highlights the container in red.

## Live Logs

AutoFlow streams standard output (`stdout`) and standard error (`stderr`) directly from your remote containers to the Live Status screen.

### High-Performance Rendering
The Desktop app uses a virtualized terminal layout to render log streams. This allows it to handle thousands of lines of rapid build output without locking up the user interface or consuming excessive local CPU.

### Log Sanitization (Scrubbing)
Before remote logs are displayed on your screen, AutoFlow processes the stream buffers through a custom sanitization engine. 
- It scans the output for patterns matching known credential formats, access tokens, and SSH keys.
- Any matched secrets are replaced with a `[REDACTED]` security indicator.
- This ensures that if a build script accidentally echoes an environment variable, it is not permanently rendered on your screen or saved in local deployment history tables.
