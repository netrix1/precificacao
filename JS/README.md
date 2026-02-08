# Versão JS puro

Esta versão mantém a mesma interface e regras da planilha, porém com backend em **JavaScript puro** (Node.js com módulos nativos `http`, `fs`, `path`, `url`) e sem plugins/frameworks/bibliotecas externas.

## Como executar

```bash
cd JS
npm start
```

A aplicação sobe em `http://localhost:3001`.

## Persistência

Os itens são persistidos em `data.json` (arquivo local), com pré-cadastro automático dos itens base quando o arquivo ainda não existe.
