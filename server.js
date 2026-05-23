import express from "express";
import cors from "cors";
import "dotenv/config";
import OpenAI from "openai";

const app = express();

app.use(cors());
app.use(express.json());

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.post("/sans-rota", async (req, res) => {
  try {
    const { origem, destino, distancia, tempo } = req.body;

    if (!origem || !destino || !distancia || !tempo) {
      return res.status(400).json({
        resposta: "calcula uma rota direito primeiro, vacilão."
      });
    }

    const resposta = await client.responses.create({
      model: "gpt-4.1-mini",
      input: `
Você é o Sans do Undertale falando dentro de um sistema de rotas.

Fale em português do Brasil.
Use humor seco, meio preguiçoso e sarcástico.
Não escreva textão.
Use no máximo 4 linhas.
Pode zoar de leve, mas explique a rota.

Dados da rota:
Origem: ${origem}
Destino: ${destino}
Distância: ${distancia}
Tempo estimado: ${tempo}
`
    });

    res.json({
      resposta: resposta.output_text
    });
  } catch (erro) {
    console.error(erro);

    res.status(500).json({
      resposta: "deu ruim aqui no meu lado. provavelmente o código tropeçou."
    });
  }
});

app.listen(3000, () => {
  console.log("Servidor rodando em http://localhost:3000");
});