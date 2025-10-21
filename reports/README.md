# report-consumer

A Node.js worker for consuming report generation tasks from RabbitMQ queues in the EVIO ecosystem.

## Features

- Consumes report jobs from RabbitMQ
- Generates PDF reports using custom fonts and images
- Modular helpers for PDF configuration, header, summary, and details
- Supports translation for multi-language reports
- TypeScript support
- Dockerfile for containerized deployment

## Folder Structure

```
assets/
  fonts/         # Custom fonts for PDF generation
  img/           # Images used in reports
src/
  config.ts      # Worker configuration
  constants.ts   # Shared constants
  consumer.ts    # RabbitMQ consumer logic
  index.ts       # Entry point
  helpers/       # PDF generation and translation helpers
  interfaces/    # TypeScript interfaces
  registry/      # Registry modules
  services/      # Service modules
```

## Installation

Clone this repository and run:

```bash
npm install
npm run build
```

## Usage

Start the worker:

```bash
npm start
```

Or build and run with Docker:

```bash
docker build -t report-consumer .
docker run --env-file .env report-consumer
```

## Configuration

- Edit `src/config.ts` and `.env` for RabbitMQ connection and other settings.
- Place custom fonts and images in the `assets/` folder.

## Development

- TypeScript strict mode enabled
- ESLint and Prettier configured
- Modular code for easy