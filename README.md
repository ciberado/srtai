# SRT-AI

A distinctively powerful command-line tool for translating subtitle files (SRT) using AWS Bedrock (Claude, etc.).

It preserves timestamps and internal formatting tags (like `<i>`, `<b>`, `<font>`) while translating the content.

## Features

- **Format Preservation**: Parses SRT files and ensures timestamps remain untouched. Formatting tags are extracted before translation and re-inserted.
- **Batch Processing**: Translates subtitles in efficient batches to respect API limits and improve speed.
- **Zip Support**: Can process individual `.srt` files or entire `.zip` archives. Input zips produce output zips with organized `originals/` and `translated/` folders.
- **Robustness**: Includes automatic retries with exponential backoff for API failures.
- **Progress Reporting**: Dynamic CLI progress bar for tracking large files.
- **Concurrency**: Parallel processing for multiple files or zip entries.

## Usage

You can run the tool directly using `npx`:

```bash
# Basic file translation
npx @ciberado/srtai translate movie.en.srt --to es --model anthropic.claude-3-haiku-20240307-v1:0

# Process a directory
npx @ciberado/srtai translate season1/*.srt --to fr

# Process a zip file
npx @ciberado/srtai translate subtitles.zip --to pt-BR
```

### Options

| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `--to` | `-t` | **Required.** Target language code (e.g., `es`, `fr`, `de`). | - |
| `--model` | `-m` | AWS Bedrock model ID. Can also be set via env var `BEDROCK_MODEL_ID`. | - |
| `--region` | `-r` | AWS Region. Can also be set via env var `AWS_REGION`. | `us-east-1` (if not set in env) |
| `--output` | `-o` | Output directory. | `./translated` |
| `--batch-size`| `-b` | Number of segments per API call. | 30 |
| `--concurrency`| `-c` | Number of files to process in parallel. | 1 |
| `--retries` | | Number of retries on API failure. | 3 |
| `--dry-run` | | Simulate translation (prefixes text with language code). | `false` |
| `--verbose` | `-v` | Enable debug logging. | `false` |

## Configuration

You can configure defaults using environment variables. Create a `.env` file in your working directory:

```env
AWS_REGION=us-east-1
# BEDROCK_MODEL_ID=global.anthropic.claude-sonnet-4-5-20250929-v1:0
BEDROCK_MODEL_ID=global.anthropic.claude-haiku-4-5-20251001-v1:0
```

### AWS Credentials

This tool relies on the standard AWS SDK credential chain. You need to have AWS credentials configured in your environment that have permission to invoke Bedrock models (`bedrock:InvokeModel`).

You can set them up in one of the following ways:

1.  **Environment Variables** (Recommended for CI/CD or temporary use):
    ```bash
    export AWS_ACCESS_KEY_ID=AKIA...
    export AWS_SECRET_ACCESS_KEY=...
    export AWS_SESSION_TOKEN=... # optional
    ```

2.  **Shared Credentials File** (Recommended for local dev):
    Run `aws configure` using the AWS CLI, or manually edit `~/.aws/credentials`:
    ```ini
    [default]
    aws_access_key_id = AKIA...
    aws_secret_access_key = ...
    ```

3.  **IAM Role** (EC2/Lambda/Containers):
    Ensure the execution role attached to your compute resource has the necessary policies.

### Recommended Models

We recommend using one of the following models for the best balance of speed and quality. These are the models currently tested with the prompt engineering used in this tool:

*   **Claude Haiku 4.5** (Fast & Cost-effective): `global.anthropic.claude-haiku-4-5-20251001-v1:0`
*   **Claude Sonnet 4.5** (High Quality): `global.anthropic.claude-sonnet-4-5-20250929-v1:0`

## Development

This project is a monorepo using npm workspaces.

### Prerequisites

- Node.js 20+
- AWS Credentials configured locally (e.g., via `~/.aws/credentials` or environment variables).

### Setup

```bash
git clone https://github.com/ciberado/srtai.git
cd srtai
npm install
```

### Build

```bash
# Build all packages
npm run build --workspaces
```

### Test

```bash
# Run unit and integration tests
npm test --workspaces
```

## Architecture

- **@ciberado/srtai-core**: Contains the logic for parsing SRTs, handling batches, and communicating with AWS Bedrock.
- **@ciberado/srtai**: The command-line interface implementation using `commander`, `cli-progress`, and `winston`.
