let mapa;
let geocoder;
let linhaAtual = null;
let marcadores = {};
let directionsService;
let directionsRenderer;
let ultimaRota = null;

const locaisPadrao = {
  A: { nome: "Brasília", lat: -15.820752, lng: -47.901531 },
  B: { nome: "Caldas Novas", lat: -17.746156, lng: -48.624302 },
  C: { nome: "Goiânia", lat: -16.687703, lng: -49.270735 },
  D: { nome: "Pirinópolis", lat: -15.857147, lng: -48.959727 }
};

const grafoPadrao = {
  A: { B: 0, D: 0 },
  B: { A: 0, C: 0 },
  C: { B: 0, D: 0 },
  D: { A: 0, C: 0 }
};

let locais = carregarJSON("rotas_locais", locaisPadrao);
let grafo = carregarJSON("rotas_grafo", grafoPadrao);

function carregarJSON(chave, reserva) {
  try {
    const salvo = localStorage.getItem(chave);
    return salvo ? JSON.parse(salvo) : structuredClone(reserva);
  } catch {
    return structuredClone(reserva);
  }
}

function salvarTudo() {
  localStorage.setItem("rotas_locais", JSON.stringify(locais));
  localStorage.setItem("rotas_grafo", JSON.stringify(grafo));
}

function calcularDistancia(p1, p2) {
  const R = 6371;
  const rad = valor => valor * Math.PI / 180;
  const dLat = rad(p2.lat - p1.lat);
  const dLng = rad(p2.lng - p1.lng);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(p1.lat)) * Math.cos(rad(p2.lat)) *
    Math.sin(dLng / 2) ** 2;

  return R * 2 * Math.asin(Math.sqrt(a));
}

function atualizarDistancias() {
  for (const origem in grafo) {
    if (!locais[origem]) continue;

    for (const destino in grafo[origem]) {
      if (!locais[destino]) {
        delete grafo[origem][destino];
        continue;
      }

      grafo[origem][destino] = calcularDistancia(locais[origem], locais[destino]);
    }
  }
}

function dijkstra(inicio, fim) {
  const distancias = {};
  const anteriores = {};
  const visitados = new Set();

  for (const no in locais) {
    distancias[no] = Infinity;
    anteriores[no] = null;
  }

  distancias[inicio] = 0;

  while (true) {
    let atual = null;

    for (const no in distancias) {
      if (!visitados.has(no) && (atual === null || distancias[no] < distancias[atual])) {
        atual = no;
      }
    }

    if (atual === null || atual === fim || distancias[atual] === Infinity) break;

    for (const vizinho in grafo[atual] || {}) {
      const novaDistancia = distancias[atual] + grafo[atual][vizinho];

      if (novaDistancia < distancias[vizinho]) {
        distancias[vizinho] = novaDistancia;
        anteriores[vizinho] = atual;
      }
    }

    visitados.add(atual);
  }

  if (distancias[fim] === Infinity) {
    return { caminho: [], distancia: Infinity };
  }

  const caminho = [];
  let atual = fim;

  while (atual) {
    caminho.unshift(atual);
    atual = anteriores[atual];
  }

  return { caminho, distancia: distancias[fim] };
}

function limparRota() {
  if (linhaAtual) {
    linhaAtual.setMap(null);
    linhaAtual = null;
  }

  if (directionsRenderer) {
    directionsRenderer.setDirections({ routes: [] });
  }
}

function desenharRota(caminho) {
  limparRota();

  const coords = caminho.map(id => ({
    lat: locais[id].lat,
    lng: locais[id].lng
  }));

  linhaAtual = new google.maps.Polyline({
    path: coords,
    strokeColor: "#c8f060",
    strokeWeight: 3,
    strokeOpacity: 0.9,
    icons: [{
      icon: {
        path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
        scale: 3,
        strokeColor: "#c8f060"
      },
      repeat: "120px"
    }],
    map: mapa
  });
}

function pintarMarcadores(caminho = []) {
  const inicio = caminho[0];
  const fim = caminho[caminho.length - 1];

  for (const id in marcadores) {
    let cor = "#ffffff";

    if (id === inicio) cor = "#c8f060";
    if (id === fim) cor = "#ff5c5c";

    marcadores[id].setIcon({
      path: google.maps.SymbolPath.CIRCLE,
      scale: 10,
      fillColor: cor,
      fillOpacity: 1,
      strokeColor: "#0e0f11",
      strokeWeight: 2
    });

    marcadores[id].setLabel({
      text: id,
      color: "#0e0f11",
      fontFamily: "'DM Mono', monospace",
      fontWeight: "500",
      fontSize: "11px"
    });
  }
}

function mostrarResultado(texto, erro = false) {
  const resultado = document.getElementById("resultado");
  resultado.textContent = texto;
  resultado.className = "resultado visivel" + (erro ? " erro" : "");
}

function atualizarRota() {
  const inicio = document.getElementById("selectOrigem").value;
  const fim = document.getElementById("selectDestino").value;

  if (!inicio || !fim) return;

  if (inicio === fim) {
    mostrarResultado("Origem e destino não podem ser o mesmo ponto.", true);
    return;
  }

  const origem = locais[inicio];
  const destino = locais[fim];

  directionsService.route({
    origin: { lat: origem.lat, lng: origem.lng },
    destination: { lat: destino.lat, lng: destino.lng },
    travelMode: google.maps.TravelMode.DRIVING
  }, (resposta, status) => {
    if (status !== "OK") {
      limparRota();
      pintarMarcadores();
      mostrarResultado("Não consegui calcular essa rota.", true);
      return;
    }

    directionsRenderer.setDirections(resposta);

    const trecho = resposta.routes[0].legs[0];
    ultimaRota = {
      origem: origem.nome,
      destino: destino.nome,
      distancia: trecho.distance.text,
      tempo: trecho.duration.text
  };

    mostrarResultado(
      `${origem.nome} → ${destino.nome}\n` +
      `Distância: ${trecho.distance.text}\n` +
      `Tempo: ${trecho.duration.text}`
    );

    pintarMarcadores([inicio, fim]);
  });
}

function optionVazia(texto) {
  const option = document.createElement("option");
  option.value = "";
  option.textContent = texto;
  return option;
}

function criarOption(id) {
  const option = document.createElement("option");
  option.value = id;
  option.textContent = `${id} — ${locais[id].nome}`;
  return option;
}

function paresConexoes() {
  const pares = [];
  const vistos = new Set();

  for (const origem in grafo) {
    for (const destino in grafo[origem]) {
      if (!locais[origem] || !locais[destino]) continue;

      const chave = [origem, destino].sort().join("-");
      if (vistos.has(chave)) continue;

      vistos.add(chave);
      pares.push([origem, destino]);
    }
  }

  return pares.sort((a, b) => a.join("").localeCompare(b.join("")));
}

function renderizarTela() {
  const ids = Object.keys(locais).sort();
  const listaPontos = document.getElementById("lista-pontos");
  const listaConexoes = document.getElementById("lista-conexoes");
  const selectsPontos = [
    document.getElementById("selectOrigem"),
    document.getElementById("selectDestino"),
    document.getElementById("removerPonto"),
    document.getElementById("conexaoOrigem"),
    document.getElementById("conexaoDestino")
  ];
  const removerConexao = document.getElementById("removerConexao");
  const valores = new Map(selectsPontos.map(select => [select.id, select.value]));
  const conexaoSalva = removerConexao.value;

  listaPontos.innerHTML = "";
  listaConexoes.innerHTML = "";
  removerConexao.innerHTML = "";

  selectsPontos.forEach(select => {
    select.innerHTML = "";
    if (select.id === "removerPonto") select.appendChild(optionVazia("Escolhe um ponto"));
  });

  if (!ids.length) {
    const li = document.createElement("li");
    li.textContent = "Nenhum ponto cadastrado.";
    listaPontos.appendChild(li);
  }

  ids.forEach(id => {
    const ponto = locais[id];
    const li = document.createElement("li");
    li.textContent = `${id} — ${ponto.nome} (${ponto.lat.toFixed(4)}, ${ponto.lng.toFixed(4)})`;
    listaPontos.appendChild(li);

    selectsPontos.forEach(select => select.appendChild(criarOption(id)));
  });

  selectsPontos.forEach(select => {
    const valorAntigo = valores.get(select.id);
    if (valorAntigo && locais[valorAntigo]) select.value = valorAntigo;
  });

  const origem = document.getElementById("selectOrigem");
  const destino = document.getElementById("selectDestino");
  const conexaoOrigem = document.getElementById("conexaoOrigem");
  const conexaoDestino = document.getElementById("conexaoDestino");

  if (origem.value === destino.value && destino.options.length > 1) destino.selectedIndex = 1;
  if (conexaoOrigem.value === conexaoDestino.value && conexaoDestino.options.length > 1) conexaoDestino.selectedIndex = 1;

  const conexoes = paresConexoes();

  if (!conexoes.length) {
    const li = document.createElement("li");
    li.textContent = "Nenhuma conexão ainda.";
    listaConexoes.appendChild(li);
    removerConexao.appendChild(optionVazia("Nada pra remover"));
  } else {
    conexoes.forEach(([a, b]) => {
      const distancia = calcularDistancia(locais[a], locais[b]);
      const texto = `${a} ↔ ${b} — ${distancia.toFixed(1)} km`;
      const valor = `${a}|${b}`;
      const li = document.createElement("li");
      const option = document.createElement("option");

      li.textContent = texto;
      listaConexoes.appendChild(li);

      option.value = valor;
      option.textContent = texto;
      removerConexao.appendChild(option);
    });
  }

  if (conexaoSalva) removerConexao.value = conexaoSalva;
}

function criarMarcador(id) {
  const marcador = new google.maps.Marker({
    position: { lat: locais[id].lat, lng: locais[id].lng },
    map: mapa,
    title: locais[id].nome,
    draggable: true,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 10,
      fillColor: "#ffffff",
      fillOpacity: 1,
      strokeColor: "#0e0f11",
      strokeWeight: 2
    },
    label: {
      text: id,
      color: "#0e0f11",
      fontFamily: "'DM Mono', monospace",
      fontWeight: "500",
      fontSize: "11px"
    }
  });

  marcador.addListener("dragend", e => {
    locais[id].lat = e.latLng.lat();
    locais[id].lng = e.latLng.lng();
    salvarTudo();
    renderizarTela();
    atualizarRota();
  });

  marcadores[id] = marcador;
}

function recriarMarcadores() {
  for (const id in marcadores) {
    marcadores[id].setMap(null);
  }

  marcadores = {};

  for (const id in locais) {
    criarMarcador(id);
  }
}

function criarPonto() {
  const id = document.getElementById("idPonto").value.trim().toUpperCase();
  const nome = document.getElementById("nomePonto").value.trim();
  const lat = parseFloat(document.getElementById("latPonto").value);
  const lng = parseFloat(document.getElementById("lngPonto").value);

  if (!id || !nome || Number.isNaN(lat) || Number.isNaN(lng)) {
    alert("Faltou preencher alguma coisa aí.");
    return;
  }

  if (!/^[A-Z0-9]{1,3}$/.test(id)) {
    alert("O ID precisa ser curto, tipo A, B, C ou E1.");
    return;
  }

  if (locais[id]) {
    alert("Já tem um ponto com esse ID.");
    return;
  }

  locais[id] = { nome, lat, lng };
  grafo[id] = {};

  criarMarcador(id);
  salvarTudo();
  renderizarTela();

  document.getElementById("idPonto").value = "";
  document.getElementById("nomePonto").value = "";
  document.getElementById("latPonto").value = "";
  document.getElementById("lngPonto").value = "";
  document.getElementById("buscarEndereco").value = "";

  mostrarResultado("Ponto criado. Agora liga ele com outro ponto pra rota funcionar.");
}

function excluirPonto() {
  const id = document.getElementById("removerPonto").value;

  if (!id || !locais[id]) return;

  if (!confirm(`Excluir o ponto ${id}?`)) return;

  delete locais[id];
  delete grafo[id];

  for (const outro in grafo) {
    delete grafo[outro][id];
  }

  if (marcadores[id]) {
    marcadores[id].setMap(null);
    delete marcadores[id];
  }

  salvarTudo();
  renderizarTela();

  if (Object.keys(locais).length >= 2) {
    atualizarRota();
  } else {
    limparRota();
    pintarMarcadores();
    mostrarResultado("Precisa ter pelo menos dois pontos pra calcular rota.", true);
  }
}

function criarConexao() {
  const origem = document.getElementById("conexaoOrigem").value;
  const destino = document.getElementById("conexaoDestino").value;

  if (!origem || !destino) return;

  if (origem === destino) {
    alert("Não dá pra ligar o ponto nele mesmo.");
    return;
  }

  grafo[origem] = grafo[origem] || {};
  grafo[destino] = grafo[destino] || {};
  grafo[origem][destino] = calcularDistancia(locais[origem], locais[destino]);
  grafo[destino][origem] = calcularDistancia(locais[destino], locais[origem]);

  salvarTudo();
  renderizarTela();
  atualizarRota();
}

function excluirConexao() {
  const valor = document.getElementById("removerConexao").value;
  if (!valor) return;

  const [a, b] = valor.split("|");

  if (grafo[a]) delete grafo[a][b];
  if (grafo[b]) delete grafo[b][a];

  salvarTudo();
  renderizarTela();
  atualizarRota();
}

function procurarLugar() {
  const busca = document.getElementById("buscarEndereco").value.trim();

  if (!busca) {
    alert("Digita algum lugar primeiro.");
    return;
  }

  geocoder.geocode({ address: busca, region: "BR" }, (resultados, status) => {
    if (status !== "OK" || !resultados[0]) {
      alert("Não achei esse lugar. Tenta escrever de outro jeito.");
      return;
    }

    const lugar = resultados[0];
    const posicao = lugar.geometry.location;
    const lat = posicao.lat();
    const lng = posicao.lng();

    document.getElementById("latPonto").value = lat.toFixed(6);
    document.getElementById("lngPonto").value = lng.toFixed(6);

    if (!document.getElementById("nomePonto").value.trim()) {
      document.getElementById("nomePonto").value = lugar.address_components[0]?.long_name || busca;
    }

    mapa.panTo({ lat, lng });
    mapa.setZoom(11);
  });
}

function resetarTudo() {
  if (!confirm("Resetar tudo e voltar pro começo?")) return;

  locais = structuredClone(locaisPadrao);
  grafo = structuredClone(grafoPadrao);

  salvarTudo();
  limparRota();
  recriarMarcadores();
  renderizarTela();
  atualizarRota();
}

function ligarBotoes() {
  document.getElementById("btnCalcular").addEventListener("click", atualizarRota);
  document.getElementById("btnCriarPonto").addEventListener("click", criarPonto);
  document.getElementById("btnCriarConexao").addEventListener("click", criarConexao);
  document.getElementById("btnExcluirPonto").addEventListener("click", excluirPonto);
  document.getElementById("btnExcluirConexao").addEventListener("click", excluirConexao);
  document.getElementById("btnBuscar").addEventListener("click", procurarLugar);
  document.getElementById("btnResetar").addEventListener("click", resetarTudo);

  document.getElementById("buscarEndereco").addEventListener("keydown", e => {
    if (e.key === "Enter") procurarLugar();
  });
}

function initMap() {
  mapa = new google.maps.Map(document.getElementById("map"), {
    zoom: 7,
    center: { lat: -16.5, lng: -48.8 },
    mapTypeId: "roadmap",
    styles: [
      { elementType: "geometry", stylers: [{ color: "#1a1d24" }] },
      { elementType: "labels.text.fill", stylers: [{ color: "#6b7280" }] },
      { elementType: "labels.text.stroke", stylers: [{ color: "#13151a" }] },
      { featureType: "road", elementType: "geometry", stylers: [{ color: "#22262f" }] },
      { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#13151a" }] },
      { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#2d3340" }] },
      { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1118" }] },
      { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#3a4050" }] },
      { featureType: "poi", stylers: [{ visibility: "off" }] },
      { featureType: "transit", stylers: [{ visibility: "off" }] },
      { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#2a2f3a" }] }
    ]
  });

  directionsService = new google.maps.DirectionsService();

  directionsRenderer = new google.maps.DirectionsRenderer({
    map: mapa,
    suppressMarkers: true,
    polylineOptions: {
      strokeColor: "#c8f060",
      strokeWeight: 4,
      strokeOpacity: 0.9
    }
  });

  mapa.addListener("click", e => {
    document.getElementById("latPonto").value = e.latLng.lat().toFixed(6);
    document.getElementById("lngPonto").value = e.latLng.lng().toFixed(6);
  });
  
  ligarBotoes();
  recriarMarcadores();
  renderizarTela();
  atualizarRota();

}
const sans = document.getElementById("sans");
const sansMusic = document.getElementById("sansMusic");

sans.addEventListener("click", async () => {
  if (sansMusic.paused) {
    sansMusic.currentTime = 0;
    sansMusic.volume = 0.5;
    sansMusic.play();
  } else {
    sansMusic.pause();
    sansMusic.currentTime = 0;
  }

   if (!ultimaRota) {
    mostrarResultado("calcula uma rota primeiro, doido.", true);
    return;
  }

  mostrarResultado("sans tá pensando nessa rota aí...");

  const resposta = await fetch("http://localhost:3000/sans-rota", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(ultimaRota)
  });

  const dados = await resposta.json();

  mostrarResultado(dados.resposta);
  });
