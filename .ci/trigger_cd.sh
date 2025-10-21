#!/usr/bin/env bash
set -euo pipefail

SERVICES_FILE="${SERVICES_FILE:-.ci/services.json}"
ENVIRONMENT="${1:-}"
SERVICES_FILTER="${SERVICES:-all}"

if [[ -z "$ENVIRONMENT" || ! "$ENVIRONMENT" =~ ^(dev|qa|prod)$ ]]; then
  echo "Uso: $0 <dev|qa|prod>"
  exit 1
fi

readarray -t SERVICES <<< "$(jq -r '.services[].name' "$SERVICES_FILE")"

if [[ "$SERVICES_FILTER" != "all" ]]; then
  IFS=',' read -ra WANT <<< "$SERVICES_FILTER"
  mapfile -t SERVICES < <(printf "%s\n" "${SERVICES[@]}" "${WANT[@]}" | sort | uniq -d)
fi

for SVC in "${SERVICES[@]}"; do
  PIPELINE=$(jq -r --arg s "$SVC" --arg e "$ENVIRONMENT" \
    '.services[] | select(.name==$s) | .pipeline[$e]' "$SERVICES_FILE")

  [[ "$PIPELINE" == "null" ]] && continue
  echo "[CD] $SVC -> $PIPELINE"
  aws codepipeline start-pipeline-execution --name "$PIPELINE" \
    --query pipelineExecutionId --output text || true
done
