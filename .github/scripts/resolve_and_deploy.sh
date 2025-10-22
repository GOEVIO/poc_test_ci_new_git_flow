#!/usr/bin/env bash
set -euo pipefail

# -------- inputs do job --------
INPUT_ENV="${INPUT_ENV:-development}"         # development|qa
INPUT_SERVICES="${INPUT_SERVICES:-all}"       # all ou "svcA,svcB"
DIFF_BASE="${DIFF_BASE:-master}"              # base para diff quando all
GIT_SHA="${GIT_SHA:-}"

FILE=".github/.ci/services.json"

# -------- normalização do ambiente --------
case "${INPUT_ENV,,}" in
  dev|development) ENV_SHORT="dev" ;;
  qa|quality|qualityassurance) ENV_SHORT="qa" ;;
  *) ENV_SHORT="${INPUT_ENV,,}" ;;
esac

echo "Environment: ${INPUT_ENV} -> ${ENV_SHORT}"
echo "Services input: ${INPUT_SERVICES}"
echo "Diff base: ${DIFF_BASE}"
echo "Commit: ${GIT_SHA}"

# -------- valida services.json --------
[ -f "$FILE" ] || { echo "::error::Falta $FILE"; exit 1; }
jq -e . "$FILE" >/dev/null

# lista total de serviços conhecidos (do ficheiro)
mapfile -t ALL_SERVICES < <(jq -r '.services[].service' "$FILE")

# util: verifica se um nome existe no ficheiro
exists_in_json() {
  local name="$1"
  for s in "${ALL_SERVICES[@]}"; do
    [[ "$s" == "$name" ]] && return 0
  done
  return 1
}

# -------- resolver lista-alvo --------
declare -a TARGETS=()

if [[ "$INPUT_SERVICES" != "all" && -n "$INPUT_SERVICES" ]]; then
  # escolher apenas os serviços pedidos que existam no json
  IFS=',' read -ra WANT <<<"$(echo "$INPUT_SERVICES" | tr -d ' ')"
  for w in "${WANT[@]}"; do
    if exists_in_json "$w"; then
      TARGETS+=("$w")
    else
      echo "::warning::Serviço '$w' não existe no services.json — ignorado."
    fi
  done
else
  # auto-deteção por diff
  git fetch origin "$DIFF_BASE":"refs/remotes/origin/$DIFF_BASE" --quiet || true
  BASE="$(git rev-parse "origin/$DIFF_BASE" 2>/dev/null || echo "")"
  [[ -z "$BASE" ]] && { echo "::warning::Base '$DIFF_BASE' não encontrada; a usar HEAD~1"; BASE="$(git rev-parse HEAD~1)"; }
  MB="$(git merge-base "$BASE" "$GIT_SHA")"

  CHANGED="$(git diff --name-only "$MB...$GIT_SHA" || true)"
  if [[ -z "$CHANGED" ]]; then
    echo "Sem alterações detetadas;"
  else
    echo "Files changed:"
    echo "$CHANGED" | sed 's/^/  - /'
    # para cada serviço, vê se houve alteração no respetivo folder
    for svc in "${ALL_SERVICES[@]}"; do
      folder=$(jq -r --arg s "$svc" '.services[] | select(.service==$s) | .folder' "$FILE")
      [[ -z "$folder" || "$folder" == "null" ]] && folder="$svc"
      if echo "$CHANGED" | grep -E "^services/${folder}/" >/dev/null; then
        TARGETS+=("$svc")
      fi
    done
  fi
fi

# deduplicar mantendo ordem
if [[ ${#TARGETS[@]} -gt 0 ]]; then
  seen=""
  uniq_targets=()
  for t in "${TARGETS[@]}"; do
    [[ ":$seen:" == *":$t:"* ]] || { uniq_targets+=("$t"); seen="$seen:$t"; }
  done
  TARGETS=("${uniq_targets[@]}")
fi

# nada para fazer?
if [[ ${#TARGETS[@]} -eq 0 ]]; then
  echo "Nenhum serviço a implantar (nada alterado ou nomes inválidos)."
  exit 0
fi

echo "Serviços alvo: ${TARGETS[*]}"

# -------- disparar pipelines: <env>-<service> --------
for svc in "${TARGETS[@]}"; do
  # validar de novo que existe no json (defensivo)
  exists_in_json "$svc" || { echo "::warning::'$svc' não está no services.json — a saltar."; continue; }

  PIPELINE="${ENV_SHORT}-${svc//_/-}"
  echo "[CD] $svc -> ${PIPELINE}"

  aws codepipeline start-pipeline-execution \
    --name "${PIPELINE}" \
    --source-revisions "[{\"actionName\":\"Source\",\"revisionType\":\"COMMIT_ID\",\"revisionValue\":\"${GIT_SHA}\"}]" \
    --query pipelineExecutionId --output text || {
      echo "::error::Falha ao iniciar pipeline ${PIPELINE}"
      exit 1
    }
done

echo "Done."
