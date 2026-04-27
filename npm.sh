#!/bin/bash
# Script to add Node.js to PATH and run npm commands

export NODE_HOME=/opt/nodejs/node-v20.11.0-linux-x64
export PATH=$NODE_HOME/bin:$PATH

# Run the command passed as argument
"$@"
