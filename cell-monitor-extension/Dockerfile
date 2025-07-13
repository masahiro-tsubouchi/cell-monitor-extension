# Use an official Python runtime as a parent image
FROM python:3.12-slim

# Set the working directory in the container
WORKDIR /app

# Install system dependencies, including Node.js and npm
RUN apt-get update && apt-get install -y curl git && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

# Enable corepack to manage yarn
RUN corepack enable

# Copy the requirements file into the container
COPY requirements.txt .

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application's source code from the host to the container
COPY . .

# Install the extension
# This will also build the frontend extension
RUN pip install --no-cache-dir .

# Schema files are now automatically placed by the build process defined in pyproject.toml.
# The manual copy logic has been removed.

# Create jupyter config directory
RUN mkdir -p /etc/jupyter

# Copy CSP configuration to allow FastAPI server connection
COPY jupyter_server_config.py /etc/jupyter/

# Expose port 8888 to the host
EXPOSE 8888

# Check if schema files are properly installed
RUN ls -la /usr/local/share/jupyter/lab/schemas/ || echo "No schemas directory" && \
    ls -la /usr/local/share/jupyter/lab/schemas/cell-monitor/ || echo "No cell-monitor schema directory"

# Run JupyterLab when the container launches
# The --ip='0.0.0.0' flag makes the server accessible from outside the container
# The --allow-root flag is necessary to run as the root user in the container
# The --no-browser flag prevents JupyterLab from trying to open a browser inside the container
# The --ServerApp.token='' disables token authentication for easier access in a local dev environment
CMD ["jupyter", "lab", "--ip=0.0.0.0", "--allow-root", "--no-browser", "--ServerApp.token="]
