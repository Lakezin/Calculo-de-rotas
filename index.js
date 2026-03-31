let mapa;
let linhaAtual = null;
let marcadores = {};

const locais = {
  A: { nome: "Brasilia", lat: -15.820752, lng: -47.901531 },
  B: { nome: "Caldas Novas", lat: -17.746156, lng: -48.624302 },
  C: { nome: "Goiânia", lat: -16.687703, lng: -49.270735 },
  D: { nome: "Pirinepólis", lat: -15.857147, lng: -48.959727 }
};

const grafo = {
  A: { B: 0, D: 0 },
  B: { A: 0, C: 0 },
  C: { B: 0, D: 0 },
  D: { A: 0, C: 0 }
};

function calcularDistancia(p1, p2) {
  const dx = p1.lat - p2.lat;
  const dy = p1.lng - p2.lng;
  return Math.sqrt(dx * dx + dy * dy);
}

function preencherDistancias() {
  for (let origem in grafo) {
    for (let destino in grafo[origem]) {
      grafo[origem][destino] = calcularDistancia(locais[origem], locais[destino]);
    }
  }
}

function dijkstra(grafo, inicio, fim) {
  let distancias = {};
  let anteriores = {};
  let visitados = new Set();

  for (let no in grafo) {
    distancias[no] = Infinity;
    anteriores[no] = null;
  }

  distancias[inicio] = 0;

  while (true) {
    let atual = null;

    for (let no in distancias) {
      if (!visitados.has(no) && (atual === null || distancias[no] < distancias[atual])) {
        atual = no;
      }
    }

    if (atual === null) break;
    if (atual === fim) break;

    for (let vizinho in grafo[atual]) {
      let nova = distancias[atual] + grafo[atual][vizinho];
      if (nova < distancias[vizinho]) {
        distancias[vizinho] = nova;
        anteriores[vizinho] = atual;
      }
    }

    visitados.add(atual);
  }

  let caminho = [];
  let atual = fim;

  while (atual) {
    caminho.unshift(atual);
    atual = anteriores[atual];
  }

  return { caminho, distancia: distancias[fim] };
}

function desenharRota(caminho) {
  if (linhaAtual) {
    linhaAtual.setMap(null);
  }

  const coords = caminho.map(p => ({
    lat: locais[p].lat,
    lng: locais[p].lng
  }));

  linhaAtual = new google.maps.Polyline({
    path: coords,
    strokeColor: "#FF0000",
    strokeWeight: 4,
    map: mapa
  });
}

function atualizarRota() {
  const chaves = Object.keys(locais);

  if (chaves.length < 2) {
    if (linhaAtual) linhaAtual.setMap(null);
    document.getElementById("resultado").innerText = "É preciso ter pelo menos 2 pontos.";
    return;
  }

  preencherDistancias();

  const inicio = chaves[0];
  const fim = chaves[chaves.length - 1];

  const resultado = dijkstra(grafo, inicio, fim);

  if (!resultado.caminho.length || resultado.distancia === Infinity) {
    if (linhaAtual) linhaAtual.setMap(null);
    document.getElementById("resultado").innerText = "Não existe rota entre os pontos escolhidos.";
    return;
  }

  desenharRota(resultado.caminho);

  document.getElementById("resultado").innerText =
    "Caminho: " + resultado.caminho.join(" → ") +
    " | Distância: " + resultado.distancia.toFixed(4);
}

function renderizarLista() {
  const lista = document.getElementById("lista-pontos");
  const select = document.getElementById("removerPonto");

  lista.innerHTML = "";
  select.innerHTML = "";

  for (let id in locais) {
    const li = document.createElement("li");
    li.textContent = `${id} - ${locais[id].nome} (${locais[id].lat.toFixed(4)}, ${locais[id].lng.toFixed(4)})`;
    lista.appendChild(li);

    const option = document.createElement("option");
    option.value = id;
    option.textContent = `${id} - ${locais[id].nome}`;
    select.appendChild(option);
  }
}

function adicionarMarcador(id) {
  const marcador = new google.maps.Marker({
    position: {
      lat: locais[id].lat,
      lng: locais[id].lng
    },
    map: mapa,
    title: locais[id].nome,
    label: id,
    draggable: true
  });

  marcador.addListener("dragend", (e) => {
    locais[id].lat = e.latLng.lat();
    locais[id].lng = e.latLng.lng();
    renderizarLista();
    atualizarRota();
  });

  marcadores[id] = marcador;
}

function criarPonto() {
  const id = document.getElementById("idPonto").value.trim().toUpperCase();
  const nome = document.getElementById("nomePonto").value.trim();
  const lat = parseFloat(document.getElementById("latPonto").value);
  const lng = parseFloat(document.getElementById("lngPonto").value);

  if (!id || !nome || isNaN(lat) || isNaN(lng)) {
    alert("Preencha todos os campos corretamente.");
    return;
  }

  if (locais[id]) {
    alert("Já existe um ponto com esse ID.");
    return;
  }

  locais[id] = { nome, lat, lng };
  grafo[id] = {};

  const idsExistentes = Object.keys(locais).filter(p => p !== id);

  for (const outro of idsExistentes) {
    grafo[id][outro] = 0;

    if (!grafo[outro]) {
      grafo[outro] = {};
    }

    grafo[outro][id] = 0;
  }

  adicionarMarcador(id);
  renderizarLista();
  atualizarRota();

  document.getElementById("idPonto").value = "";
  document.getElementById("nomePonto").value = "";
  document.getElementById("latPonto").value = "";
  document.getElementById("lngPonto").value = "";
}

function excluirPonto() {
  const id = document.getElementById("removerPonto").value;

  if (!id || !locais[id]) {
    return;
  }

  delete locais[id];

  if (marcadores[id]) {
    marcadores[id].setMap(null);
    delete marcadores[id];
  }

  delete grafo[id];

  for (let outro in grafo) {
    if (grafo[outro][id] !== undefined) {
      delete grafo[outro][id];
    }
  }

  renderizarLista();
  atualizarRota();
}

function initMap() {
  mapa = new google.maps.Map(document.getElementById("map"), {
    zoom: 7,
    center: { lat: -26.5, lng: -49.2 }
  });
  mapa.addListener("click", (e) => {
  const lat = e.latLng.lat();
  const lng = e.latLng.lng();

  document.getElementById("latPonto").value = lat.toFixed(6);
  document.getElementById("lngPonto").value = lng.toFixed(6);
});

  for (let id in locais) {
    adicionarMarcador(id);
  }

  renderizarLista();
  atualizarRota();
}