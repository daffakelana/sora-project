"use server";

// AI gratis pakai Groq (key dari https://console.groq.com/keys), endpoint
// OpenAI-compatible + JSON mode. Key server-side di GROQ_API_KEY.

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

// Coba model utama dulu; kalau 429/limit, jatuh ke model yang lebih ringan.
const GROQ_MODELS = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];

// Helper bersama: kirim messages ke Groq, minta JSON, kembalikan objek hasil
// parse atau { error }.
async function groqJSON(messages) {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    return { error: "GROQ_API_KEY belum di-set di .env.local." };
  }

  let lastError = "Gagal menghubungi AI.";

  for (const model of GROQ_MODELS) {
    try {
      const response = await fetch(GROQ_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          response_format: { type: "json_object" },
          max_tokens: 600,
          temperature: 0.7,
        }),
      });

      if (response.status === 429) {
        lastError = "Kuota AI gratis sedang penuh (429). Coba lagi sebentar lagi.";
        continue;
      }

      if (!response.ok) {
        const detail = await response.text();
        return { error: `Groq error (${response.status}): ${detail.slice(0, 200)}` };
      }

      const data = await response.json();
      const text = data?.choices?.[0]?.message?.content ?? "{}";
      return { data: JSON.parse(text) };
    } catch (error) {
      lastError = error?.message || "Gagal menghubungi AI.";
    }
  }

  return { error: lastError };
}

// Buat SATU contoh kalimat Jerman yang sesuai konteks kata + terjemahan Indonesia.
export async function generateExample(word, existingGerman = []) {
  const avoid =
    existingGerman.length > 0
      ? `Jangan mengulang kalimat berikut: ${existingGerman.join(" | ")}.`
      : "";

  const result = await groqJSON([
    {
      role: "system",
      content:
        "Kamu guru bahasa Jerman. Buat SATU kalimat contoh bahasa Jerman yang " +
        "natural, benar secara tata bahasa, level A1-A2, dan benar-benar memakai " +
        "kata yang diberikan secara kontekstual, beserta terjemahan bahasa " +
        'Indonesia yang akurat. Balas HANYA JSON: {"german": "<kalimat>", "indonesian": "<terjemahan>"}.',
    },
    {
      role: "user",
      content:
        `Kata Jerman: "${word.german}" ` +
        `(arti: ${word.indonesian}; jenis: ${word.type}). ${avoid}`,
    },
  ]);

  if (result.error) {
    return { error: result.error };
  }

  const { german, indonesian } = result.data || {};
  if (!german || !indonesian) {
    return { error: "Balasan AI tidak lengkap." };
  }
  return { german, indonesian };
}

// Cocokkan kata Jerman dengan padanan Indonesianya (untuk pewarnaan match).
// Mengembalikan { german: [{text, group}], indonesian: [{text, group}] }.
// Kata yang berpadanan diberi nomor `group` yang sama; group 0 = tanpa padanan.
export async function alignWords(german, indonesian) {
  const result = await groqJSON([
    {
      role: "system",
      content:
        "Kamu ahli linguistik. Pecah KEDUA kalimat menjadi token kata. Beri " +
        "nomor 'group' yang SAMA untuk kata Jerman dan kata Indonesia yang " +
        "artinya berpadanan. Pakai group 0 untuk kata tanpa padanan langsung. " +
        "Pertahankan urutan kata asli masing-masing bahasa. Balas HANYA JSON " +
        'dengan bentuk: {"german":[{"text":"Ich","group":1}],"indonesian":[{"text":"Aku","group":1}]}.',
    },
    {
      role: "user",
      content: `Jerman: "${german}"\nIndonesia: "${indonesian}"`,
    },
  ]);

  if (result.error) {
    return { error: result.error };
  }

  const data = result.data || {};
  if (!Array.isArray(data.german) || !Array.isArray(data.indonesian)) {
    return { error: "Balasan AI tidak lengkap." };
  }
  return { german: data.german, indonesian: data.indonesian };
}
