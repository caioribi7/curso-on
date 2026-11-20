#!/bin/sh
# Instala o painel `curso-on` (Linux e macOS).
#   curl -fsSL https://raw.githubusercontent.com/caioribi7/curso-on/main/install.sh | sh
#
# Variáveis opcionais:
#   CURSO_ON_VERSION      versão (ex.: v0.1.0). Padrão: a mais recente.
#   CURSO_ON_INSTALL_DIR  pasta de instalação. Padrão: ~/.local/bin
#   CURSO_ON_NO_CLONE=1   não baixa o projeto (só instala o painel)
#   CURSO_ON_NO_OPEN=1    não abre o painel no fim
set -eu

REPO="caioribi7/curso-on"
VERSION="${CURSO_ON_VERSION:-latest}"
DIR="${CURSO_ON_INSTALL_DIR:-$HOME/.local/bin}"

say() { printf '\033[1;34m›\033[0m %s\n' "$1"; }
die() { printf '\033[1;31m✗ %s\033[0m\n' "$1" >&2; exit 1; }

case "$(uname -s)" in
  Linux) os=linux ;;
  Darwin) os=macos ;;
  *) die "Sistema não suportado: $(uname -s). No Windows, use o install.ps1." ;;
esac
case "$(uname -m)" in
  x86_64 | amd64) arch=x86_64 ;;
  arm64 | aarch64) arch=arm64 ;;
  *) die "Processador não suportado: $(uname -m)." ;;
esac
[ "$os" = linux ] && [ "$arch" = arm64 ] && die "Ainda não há binário para Linux ARM. Instale com: cargo install --git https://github.com/$REPO curso-on"

asset="curso-on-$os-$arch"
if [ "$VERSION" = latest ]; then
  base="https://github.com/$REPO/releases/latest/download"
else
  base="https://github.com/$REPO/releases/download/$VERSION"
fi

command -v curl >/dev/null 2>&1 || die "Preciso do curl."
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

say "Baixando $asset ($VERSION)…"
curl -fsSL "$base/$asset" -o "$tmp/curso-on" || die "Não consegui baixar $base/$asset"
curl -fsSL "$base/SHA256SUMS" -o "$tmp/SHA256SUMS" || die "Não consegui baixar a lista de checksums."

expected="$(grep " $asset\$" "$tmp/SHA256SUMS" | cut -d' ' -f1)"
[ -n "$expected" ] || die "Checksum de $asset não encontrado."
if command -v sha256sum >/dev/null 2>&1; then
  actual="$(sha256sum "$tmp/curso-on" | cut -d' ' -f1)"
else
  actual="$(shasum -a 256 "$tmp/curso-on" | cut -d' ' -f1)"
fi
[ "$expected" = "$actual" ] || die "O arquivo baixado não confere com o checksum. Nada foi instalado."

mkdir -p "$DIR"
install -m 755 "$tmp/curso-on" "$DIR/curso-on"
[ "$os" = macos ] && xattr -d com.apple.quarantine "$DIR/curso-on" 2>/dev/null || true
say "Instalado em $DIR/curso-on"

case ":$PATH:" in
  *":$DIR:"*) ;;
  *)
    profile="$HOME/.profile"
    case "${SHELL:-}" in
      */zsh) profile="$HOME/.zshrc" ;;
      */bash) profile="$HOME/.bashrc" ;;
    esac
    printf '\n# curso-on\nexport PATH="%s:$PATH"\n' "$DIR" >> "$profile"
    say "Adicionei $DIR ao PATH em $profile. Abra um terminal novo."
    ;;
esac

# Baixa o projeto em ./curso-on (se ainda não estiver aqui) e abre o painel.
project=""
if [ -f package.json ] && grep -q '"name": "curso-on"' package.json 2>/dev/null; then
  project="."
elif [ -d curso-on/.git ]; then
  project="curso-on"
elif [ -z "${CURSO_ON_NO_CLONE:-}" ]; then
  if command -v git >/dev/null 2>&1; then
    say "Baixando o projeto em $(pwd)/curso-on…"
    git clone --quiet "https://github.com/$REPO.git" curso-on && project="curso-on"
  else
    say "Sem git: o painel baixa o projeto depois (Configurar → Baixar o Curso On)."
  fi
fi

printf '\n\033[1;32m✓ Pronto!\033[0m'
if [ -n "$project" ] && [ "$project" != "." ]; then
  printf ' Projeto em \033[1m%s/%s\033[0m.' "$(pwd)" "$project"
fi
printf ' Para abrir o painel: \033[1mcurso-on\033[0m\n'

# Abre o painel já (o script vem de um pipe, então o teclado vem do /dev/tty).
if [ -z "${CURSO_ON_NO_OPEN:-}" ] && [ -t 1 ] && { : </dev/tty; } 2>/dev/null; then
  say "Abrindo o painel…"
  [ -n "$project" ] && cd "$project"
  exec "$DIR/curso-on" </dev/tty
fi
