# Changesets

Cada mudança no `@fluxo/react` que deve sair numa versão leva um arquivo aqui, criado com `pnpm changeset`.
O arquivo diz o tipo da mudança (patch, minor ou major) e uma frase para o CHANGELOG.

- Mudança incompatível só em versão **maior** (design.md §3).
- O app casca (pacote `shell`) não é publicado e fica fora do versionamento.
- Ao entrar na `main`, o workflow `publicar.yml` abre o PR de versão; ao aceitar esse PR, o pacote é publicado no GitHub Packages.
