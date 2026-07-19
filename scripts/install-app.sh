#!/bin/bash
# Copia o build de dist/mac-universal para /Applications.
#
# Só o bundle .app é substituído. Os dados do usuário (login, cookies, cache,
# window-state.json) vivem em ~/Library/Application Support/pinp e nunca são
# tocados aqui — por isso trocar o bundle inteiro é uma atualização, não um
# reset.
set -euo pipefail

APP_NAME="pinp.app"
SRC="$(cd "$(dirname "$0")/.." && pwd)/dist/mac-universal/$APP_NAME"
DEST="/Applications/$APP_NAME"

if [ ! -d "$SRC" ]; then
  echo "Build não encontrado em $SRC — rode 'npm run build' antes." >&2
  exit 1
fi

# Substituir arquivos por baixo de um app rodando quebra a assinatura em
# memória e o app trava. Encerra antes.
if pgrep -x "pinp" > /dev/null; then
  echo "Encerrando pinp em execução..."
  osascript -e 'quit app "pinp"' 2>/dev/null || pkill -x "pinp" || true
  for _ in $(seq 20); do
    pgrep -x "pinp" > /dev/null || break
    sleep 0.25
  done
fi

if [ -e "$DEST" ]; then
  # Guardas: o rm só roda se o alvo for exatamente o bundle esperado.
  # Um symlink ou um diretório qualquer aborta em vez de ser apagado.
  if [ -L "$DEST" ]; then
    echo "$DEST é um symlink — abortando por segurança." >&2
    exit 1
  fi
  if [ ! -d "$DEST/Contents/MacOS" ]; then
    echo "$DEST existe mas não parece um app bundle — abortando." >&2
    exit 1
  fi
  echo "Removendo versão anterior..."
  rm -rf -- "$DEST"
fi

# ditto preserva metadados e recursos do bundle melhor que cp -R, o que
# importa para a assinatura ad-hoc sobreviver à cópia.
echo "Instalando em $DEST..."
ditto "$SRC" "$DEST"

echo "Pronto: $DEST"
