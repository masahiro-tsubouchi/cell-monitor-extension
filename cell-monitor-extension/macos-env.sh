# macOS optimization settings for JupyterLab development
export NODE_OPTIONS="--max-old-space-size=8192"
export JUPYTER_CONFIG_DIR="$PWD/.jupyter"
export CHOKIDAR_USEPOLLING=false  # macOSネイティブFSEvents使用
