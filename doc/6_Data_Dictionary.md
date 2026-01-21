# Data Dictionary

## **autoflow.config.json**
This file stores the project-specific configuration for deployment.

| Field Name | Data Type | Requirement | Description |
| :--- | :--- | :--- | :--- |
| **projectName** | String | Mandatory | The unique identifier for the project. Used for Docker container naming and folder structure on the server. Derived from the current folder name by default. |
| **gitRepo** | String | Mandatory | The HTTPS URL of the Git repository to be deployed. AutoFlow pushes to and pulls from this repository. |
| **serverIp** | String | Mandatory | The public IP address of the remote server (VPS/VM). |
| **sshUser** | String | Mandatory | The username used to authenticate SSH connections (e.g., `root`, `ubuntu`). |
| **sshPort** | Integer | Optional | The port number for SSH connections. Defaults to `22`. |
| **sshKeyPath** | String | Mandatory | Absolute local path to the private SSH key file (e.g., `~/.ssh/id_rsa`). Used for authentication without a password. |
| **appPort** | Integer | Mandatory | The port number the application listens on. This port is exposed from the Docker container to the host machine. |

## **Environment Variables (Runtime)**
These internal variables are used during execution but not stored in the config file.

| Variable | Scope | Description |
| :--- | :--- | :--- |
| **process.cwd()** | Local | Current working directory, used to locate config files and source code. |
| **dockerfilePath** | Local | Resolved path to the `Dockerfile`. |
| **ignorePath** | Local | Resolved path to `.dockerignore`. |
