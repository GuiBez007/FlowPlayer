# FlowPlayer - Reprodutor de Músicas 🎵

FlowPlayer é um reprodutor de músicas moderno, responsivo e rico visualmente, construído sobre Node.js + Express (backend) e HTML5, CSS3 e Javascript Vanilla (frontend). Ele é projetado especificamente para navegar em coleções locais organizadas em pastas dentro de `/data`, funcionando como um Windows Explorer dedicado para as suas faixas.

---

## ✨ Recursos

- **Navegação Estilo Windows Explorer**: Explore pastas e subpastas de forma rápida, com suporte a histórico (voltar nível) e breadcrumbs inteligentes.
- **Estruturas Mistas**: Entende e exibe dinamicamente subdiretórios e arquivos suportados na mesma tela.
- **Barra de Reprodução Premium**:
  - Controles completos: Play, Pause, Próxima, Anterior, Loop (Desativado, Repetir Pasta, Repetir Faixa) e Ordem Aleatória (Shuffle).
  - Autoplay automático da próxima música ao finalizar a atual.
  - Sliders interativos customizados de volume e progresso com suporte a arrastar e clicar.
- **Painel de Vídeo Flutuante**: Como os arquivos na pasta são `.mp4` (vídeo), um painel flutuante e ocultável exibe o vídeo se desejado. Se minimizado ou fechado, a música continua rodando perfeitamente em background.
- **Visualizador de Áudio Real-Time (Web Audio API)**:
  - 4 temas animados desenhados no canvas: *Barras Reativas*, *Onda Senoidal Suave*, *Círculo Pulsante*, e *Grade Neon Retro*.
  - Slider para controlar a sensibilidade visual em tempo real.
- **Busca em Tempo Real**: Filtre os itens da pasta ativa instantaneamente à medida que digita.
- **Tema Escuro Neon**: Design premium com efeito translúcido (*glassmorphic*), glows interativos e animações fluidas.

---

## 📂 Estrutura de Arquivos

```
i:/Reprodutor de Músicas/
├── data/                       # Pasta onde ficam suas músicas/vídeos (separados ou misturados em subpastas)
├── public/                     # Frontend
│   ├── index.html              # Layout HTML5 estruturado
│   ├── style.css               # Estilos com CSS customizado, animações e responsividade
│   └── app.js                  # Lógica do reprodutor, queue, visualizer e explorer
├── server.js                   # Backend em Express.js (browse API, streaming seguro de mídia)
├── package.json                # Gerenciador de pacotes e scripts do node
└── README.md                   # Este arquivo de documentação
```

---

## 🚀 Como Executar

### 1. Pré-requisitos
- Ter o [Node.js](https://nodejs.org/) instalado na versão v18+.

### 2. Instalação e Execução
No terminal do projeto (na pasta `i:/Reprodutor de Músicas/`), execute:

```bash
# Instalar as dependências (Express)
npm install

# Iniciar o servidor
npm start
```

O terminal exibirá:
`Servidor rodando em http://localhost:3000`

Abra [http://localhost:3000](http://localhost:3000) no seu navegador para começar a escutar as músicas.
