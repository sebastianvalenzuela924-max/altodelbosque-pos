# Build Project Workflow

This workflow describes how to build the Altodelbosque project.

## Steps

1. **Install Dependencies**:
   Run `npm install` to install all required packages.
   *Note: On Windows, `cross-env` is used for environment variable handling.*

2. **Install cross-env** (if not already present):
   Run `npm install --save-dev cross-env` to ensure cross-platform compatibility for build scripts.

3. **Run Build**:
   Run `npm run build` to create an optimized production build.
   *The script in `package.json` should be `"build": "cross-env NODE_ENV=production next build"`.*
