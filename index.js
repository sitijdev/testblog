const { GoogleGenerativeAI } = require('@google/generative-ai');
const GOOGLE_IMG_SCRAP = require('google-img-scrap').GOOGLE_IMG_SCRAP;
const GOOGLE_QUERY = require('google-img-scrap').GOOGLE_QUERY;
const {google} = require('googleapis');
const fs = require('fs');
const axios = require('axios');

// Konfigurasi Gemini API
const genAI = new GoogleGenerativeAI('AIzaSyBpUlpu6Ekn1YSE8aCdhUBKGPEffpop7wc'); // Ganti dengan API Key Gemini kamu
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Fungsi untuk scraping gambar dari Google Images (5 gambar)
async function scrapeImages(keyword) {
  try {
    const result = await GOOGLE_IMG_SCRAP({
      search: keyword,
      excludeDomains: ['istockphoto.com', 'fb.com', 'stablecog.com', 'img.stablecog.com', 'pixabay.com', 'pinimg.com', 'pinterest.com', 'instagram.com', 'facebook.com', 'tiktok.com', 'alamy.com'],
      limit: 5,
      query: {
        SIZE: GOOGLE_QUERY.SIZE.LARGE
      }
    });

    // Ambil URL gambar dari hasil scraping
    const imageUrls = result.result.map(image => image.url);
    return imageUrls;
  } catch (error) {
    console.error("Error saat scraping gambar:", error);
    return [];
  }
}

// Fungsi untuk generate artikel dengan Gemini API
async function generateArticle(keyword) {
  const prompt = `Buat artikel dalam bahasa inggris yang memenuhi kriteria artikel seo sempurna tentang ${keyword}. Artikel terdiri dari 5 alinea dengan susunan yang rapi dan profesional. Artikel harus enak dibaca dan sudah siap tayang tanpa perlu edit lagi. Jangan gunakan karakter * (bintang) di artikel yang dibuat!`;
  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    // Pisahkan alinea dengan regex (misalkan, setiap baris baru adalah alinea baru)
    const paragraphs = text.split('\n');

    // Bungkus setiap alinea dengan tag <p>
    const formattedText = paragraphs.map(paragraph => `<p>${paragraph}</p>`).join('');

    console.log('Generated article:', formattedText);
    return formattedText;
  } catch (error) {
    console.error('Error Gemini API:', error);
    throw error;
  }
}

// Fungsi untuk membuat konten blog post
function createBlogPostContent(keyword, imageUrls, article) {
  let content = `<h1>${keyword}</h1>`;

  if (imageUrls.length > 0) {
    content += `<img src="${imageUrls[0]}" alt="${keyword} - Main image"><br>`; // Alt text lebih deskriptif

    content += article;

    if (imageUrls.length > 1) {
      content += '<div class="image-gallery" style="display: flex; flex-wrap: wrap; justify-content: space-between;">'; // Tambahkan class CSS
      for (let i = 1; i < imageUrls.length; i++) {
        content += `
          <figure style="width: 48%; margin-bottom: 10px;"> 
            <img src="${imageUrls[i]}" alt="${keyword} - Gallery image ${i}">
            <figcaption>Image caption ${i}</figcaption>  
          </figure>`; // Tambahkan figcaption
      }
      content += '</div>';
    }
  } else {
    content += `<p>No images found for ${keyword}.</p>`; // Pesan jika tidak ada gambar
    content += article;
  }

  return content;
}


// Fungsi untuk posting ke Blogger menggunakan API
async function postToBlogger(title, content, blogId, refreshToken, clientId, clientSecret) {
  try {
    // Inisialisasi Google Client dengan refresh token
    const client = new google.auth.OAuth2(clientId, clientSecret);
    client.setCredentials({ refresh_token: refreshToken });

    // Buat objek Blogger API
    const blogger = google.blogger({ version: 'v3', auth: client });

    // Buat resource post baru
    const res = await blogger.posts.insert({
      blogId: blogId,
      resource: {
        title: title,
        content: content,
      },
    });

    console.log('Post berhasil dibuat:', res.data.url);
  } catch (error) {
    console.error('Gagal membuat post:', error);
  }
}

// Fungsi utama
async function main() {
  const response = await axios.get(
    'https://raw.githubusercontent.com/fdciabdul/Google-Trends-Keywords-Scraper/main/forcopied/INDONESIA.txt'
  );

  const keywords = response.data.split(',');

  // Baca refresh token, client ID, dan client secret dari file
  const refreshToken = fs.readFileSync(`admin.txt`, 'utf8');
  const clientId = fs.readFileSync(`client_id.txt`, 'utf8');
  const clientSecret = fs.readFileSync(`client_secret.txt`, 'utf8');

  for (const keyword of keywords) {
    if (keyword.trim() !== "") {
      try {
        console.log(`Memproses keyword: ${keyword}`);
        const imageUrls = await scrapeImages(keyword);
        const article = await generateArticle(keyword);
        const content = createBlogPostContent(keyword, imageUrls, article);

        // Post ke Blogger
        await postToBlogger(keyword, content, '6914798631123351311', refreshToken, clientId, clientSecret); 

      } catch (error) {
        console.error(`Error memproses keyword ${keyword}:`, error);
      }
    }
  }
}

main();
