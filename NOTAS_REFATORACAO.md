# Notas de Refatoração

## Fase 0 — Configuração inicial e extração verbatim
- Extração do HTML/CSS e do script original para `src/main.js` com import do Three.js `three@0.128.0`.
- Zero alterações de lógica ou fórmulas.
- Cópia intacta de referência preservada em `legacy/galeao_original.html`.
- Proteção com `try...catch` nas chamadas a `setPointerCapture` para evitar `InvalidStateError` lançado pelo navegador em eventos de ponteiro sem captura ativa / iframe.

## Fase 1 — Extração do Núcleo (`src/core/`)
- **`src/core/math.js`**: Extração de utilitários matemáticos e vetoriais (`rnd`, `clamp`, `m3`, `c3`, `K`, `wrapA`, `D2`).
- **`src/core/palettes.js`**: Paletas de cores e tons para céu, mar raso/profundo, espuma e iluminação (`SKY`, `DEEP`, `SHAL`, `CLD`, `FOAM`, `WH`, `GC`).
- **`src/core/renderer.js`**: Setup do renderer Three.js, cena, câmera em perspectiva, luzes globais e redimensionamento responsivo (`R`, `sc`, `cam`, `sky`, `sunL`, `hemi`, `fLight`, `cv`, `resize`).
- **`src/core/state.js`**: Agrupamento modular do estado reativo e parâmetros físicos (`S`, `WI`, `ST`, `SEAS`, `CAM`, `INT`, `UIS`, `LT`, `FX`, `FL`, `HM`, `AN`, `PL`, `fp`, `keys`, `joy`, `lk`).
- **`src/main.js`**: Migração e substituição de todas as variáveis globais avulsas pelos respectivos objetos e módulos em `src/core/`, mantendo 100% de paridade visual, física e funcional com a versão original.

## Fase 2 — Extração do Mundo e Ambiente (`src/world/`)
- **`src/world/ocean.js`**: Extração da malha do mar jitterizada, ondas de Gerstner, função analítica de altura de onda `H(x, z)`, cálculo de direção `setWaveDir(a)` e atualização contínua de vértices e cores de água/espuma `updSea(s)`.
- **`src/world/archipelago.js`**: Extração do gerador completo de arquipélago procedural infinito em low-poly (`ILHAS`), incluindo biomas, árvores, pedras, flores, arbustos, troncos, sistema de colisão com casco `hit(px, pz, hd)`, busca de porto seguro `safeNear`, chunk LOD management e ajuste de parâmetros pelo painel.
- **`src/world/clouds.js`**: Extração do conjunto de nuvens procedurais low-poly facetadas (`clouds`, `cm`, `cg`).
- **`src/world/weather.js`**: Extração da atmosfera, partículas e clima: chuva em GPU buffers (`rain`), riscos de vento aparente (`skM`), relâmpagos procedurais com curva spline (`bolt`, `strike`), esteira de espuma e boias de referência com altura da onda (`wkM`, `updExtras`), riscos de velocidade na água (`spM`, `updSpeedFx`), sol procedural facetado com raios e halos (`sunG`, `updSun`), e orquestração do clima e neblina volumétrica (`updAtmosphere`).
- **`src/main.js`**: Redução massiva de código inline, importando diretamente `ocean.js`, `archipelago.js`, `clouds.js` e `weather.js`, preservando integralmente o ciclo de simulação física, hidrodinâmica e renderização gráfica.

## Fase 3 — Extração da Embarcação (`src/ship/ship.js`)
- **`src/ship/ship.js`**: Extração completa da modelagem geométrica procedural do galeão pirata (`SH`, `ship`, `fl`):
  - Casco low-poly em seções curvas longitudinais e transversais com gradiente de verniz e madeira envelhecida.
  - Vergas articuladas (`rigs`) e 5 panos de velas dinâmicos (`sails`: Grande, Gávea, Joanete, Bujarrona e Mezena).
  - Cordame estático e dinâmico: brandais, ovéns, enxárcias, estais em curvas Bezier e amarras com deformação catenária.
  - Bandeira Jolly Roger com brasão clássico pirata e tecido animado.
  - Roda do leme móvel com manetes de bronze (`wh`, `HM`).
  - Âncora de ferro fundido com cabrestante giratório e cabo esticado (`anc`, `arope`, `cap`).
  - Escadas de cordas bombordo/estibordo coladas ao casco para embarque/desembarque.
  - Mapeamento de colisores de caminhada pelo convés (`walk`), obstáculos e zonas de interação (`inter`).

## Fase 4 — Extração da Física e Interações do Jogador (`src/ship/physics.js`, `src/ship/player.js`)
- **`src/ship/physics.js`**:
  - Simulação completa de aerodinâmica das velas (forças de arrasto $C_D$, sustentação $C_L$, estol, placa e sombreamento de vento entre velas).
  - Hidrodinâmica do casco: balanço nas ondas de Gerstner, sustentação lateral da quilha, deriva, arrasto parabólico, leme e momento de restauração da banda com ângulo de emborcamento $GZ$.
  - Física da âncora fundeada: contenção por raio de cabo elástico, frenagem exponencial e rotação por alinhamento à correnteza.
- **`src/ship/player.js`**:
  - Sistema de câmera em primeira pessoa (FPV) no convés com travamento de ponteiro e rotação Euler.
  - Locomoção em primeira pessoa: caminhada no convés com detecção de obstáculos da amurada, pulo, queda livre gravitacional ao mar.
  - Nado em alto-mar ao cair na água, detecção de proximidade do casco e escalada interativa de escadas de corda.
  - Sistema completo de interação táctil e por teclado (`[E]`, `[Q]`, cunhos, adriças, escotas, cabrestante da âncora e roda do leme).
  - Brilho emissivo e realce visual pulsante de cordas e controles ativos (`updGlow`, `updGlowHelm`).
- **`src/main.js`**:
  - Redução massiva do ponto de entrada para ~130 linhas de orquestração limpa e declarativa, interligando o ciclo gráfico Three.js às camadas modulares de física, mundo e jogador.

## Fase 5 — Extração da Interface e Loop Central (`src/ui.js`, `src/main.js`)
- **`src/ui.js`**: Extração de toda a lógica de painel HTML, HUD e interação de controles:
  - Botões de modos de mar e vento com sliders reativos (`setWindStr`, `btn`, `sl`, `stx`).
  - Painel de abertura individual e coletiva das 5 velas com sliders percentuais (`rows`, `SL`, `setAll`).
  - Painel de rotação angular das vergas com sliders de graus e limiares físicos (`rrows`, `rigs`, `lim`).
  - Rosa dos ventos e mostrador vetorial HUD (`updWindHud`) com rumo relativo, velocidade em nós, ângulo de banda e $GZ$.
  - Indicador e acionador da âncora (`updAnchor`, `anb`).
  - Controles e parâmetros do mapa procedural de ilhas (`mapTick`, `mapRelocate`, semente, densidade, altura, relevo).
  - Trava de controles manuais (`lockUI`), modo de arame (`wf`) e giro automático (`ar`).
- **`src/main.js`**:
  - Refatoração do ciclo de vida principal (`loop`), orquestrando as camadas com alta legibilidade e responsabilidade única.
  - Zero duplicações, zero variáveis globais dispersas e zero perda de performance ou fidelidade física e visual.

## Fase 6 — Auditoria Final, Otimização e Verificação de Integridade
- **Auditoria de dependências e bundling**:
  - Verificação e aprovação do build de produção via Vite (`npm run build` gerando `dist/`).
  - Verificação de tipos TypeScript e conformidade sem erros (`tsc --noEmit`).
- **Verificação de conformidade arquitetural**:
  - `src/core/`: matemática pura, paletas, setup Three.js e gerenciamento de estado.
  - `src/world/`: malha do oceano com ondas de Gerstner, arquipélago procedural infinito, nuvens low-poly e sistema de clima/atmosfera.
  - `src/ship/`: modelagem da embarcação, hidrodinâmica/aerodinâmica avançada, locomoção e interações FPV do jogador.
  - `src/ui.js`: manipulação de DOM, HUD responsivo, inputs e atalhos.
  - `src/main.js`: orquestrador enxuto (~130 linhas) de alta performance.
- **Paridade funcional completa**:
  - Mantida paridade estrita de 100% com a simulação original, sem alteração de fórmulas físicas ou comportamentos táteis.
