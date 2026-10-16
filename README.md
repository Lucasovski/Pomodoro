# 🍅 Pomodoro Foco

Aplicativo web de foco Pomodoro, limpo e sem dependências (HTML + CSS + JavaScript puro). Os dados são salvos automaticamente com `localStorage`.

## Funcionalidades

- **Três modos**: Foco, Pausa Curta e Pausa Longa, com cores distintas por modo.
- **Controles completos**: Iniciar, Pausar, Continuar e Zerar (atalho: barra de espaço).
- **Durações personalizadas**: configure os minutos de cada modo, quantos pomodoros até a pausa longa, início automático do próximo modo e som de conclusão (painel ⚙️).
- **Estatísticas de hoje**: pomodoros concluídos, tempo total de foco e pausas feitas — zeradas automaticamente a cada novo dia.
- **Extras**: anel de progresso animado, tempo restante no título da aba, notificações "toast", confirmação ao trocar de modo com timer em andamento e som gerado via Web Audio (sem arquivos externos).

## Como usar

Basta abrir o `index.html` em um navegador moderno, ou servir a pasta localmente:

```bash
python3 -m http.server 8000
# depois acesse http://localhost:8000
```

## Persistência (localStorage)

| Chave | Conteúdo |
|---|---|
| `pomodoro.settings.v1` | Durações personalizadas e preferências |
| `pomodoro.session.v1` | Modo atual e progresso do ciclo de pomodoros |
| `pomodoro.stats.v1` | Estatísticas do dia (concluídos, minutos de foco, pausas) |

## Arquivos

- `index.html` — estrutura da interface
- `style.css` — estilos (design limpo e responsivo)
- `app.js` — lógica do timer, configurações, estatísticas e persistência