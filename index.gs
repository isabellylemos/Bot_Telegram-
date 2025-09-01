const TOKEN = "8198414156:AAF1_PMohNU19m7166zsWj4ddNdBh_rP-4s";
const SPREADSHEET_ID = "1XitCM-zj1eClrLYn2SJpn6KscZJw1Yd2k-WcsD8svDs";
const SHEET_NAME = "SCRUM";
const CONTACTS_SHEET_NAME = "CONTATOS";

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const chatId = data.message.chat.id;
  const text = data.message.text;

  const state = getState(chatId);

  if (!state) {
    if (text.toLowerCase() === "oi" || text.toLowerCase() === "/start") {
      sendMessage(chatId, "Olá! Qual seu nome?");
      setState(chatId, "ASK_NAME");
    } else {
      sendMessage(chatId, 'Por favor, digite "Oi" para começar o SCRUM.');
    }
    return;
  }

  switch (state) {
    case "ASK_NAME":
      setState(chatId, "ASK_YESTERDAY");
      setUserData(chatId, "name", text);
      setUserData(chatId, "chatId", chatId); // salva chatId
      saveContact(chatId); // salva na aba CONTATOS para mensagens diárias
      sendMessage(chatId, "O que você fez ontem?");
      break;

    case "ASK_YESTERDAY":
      setState(chatId, "ASK_TODAY");
      setUserData(chatId, "yesterday", text);
      sendMessage(chatId, "O que você fará hoje?");
      break;

    case "ASK_TODAY":
      setState(chatId, "ASK_BLOCKERS");
      setUserData(chatId, "today", text);
      sendMessage(chatId, "Você tem algum impedimento?");
      break;

    case "ASK_BLOCKERS":
      setUserData(chatId, "blockers", text);
      saveToSheet(chatId);
      sendMessage(chatId, "Obrigado! Seu SCRUM foi registrado.");
      clearState(chatId);
      clearUserData(chatId);
      break;

    default:
      sendMessage(
        chatId,
        'Erro: estado desconhecido. Digite "Oi" para começar.'
      );
      clearState(chatId);
      clearUserData(chatId);
  }
}

// Salva chatId na aba CONTATOS (se ainda não existir)
function saveContact(chatId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(CONTACTS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONTACTS_SHEET_NAME);
    sheet.appendRow(["chatId"]);
  }

  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  const exists = data.some((row) => row[0] === chatId);

  if (!exists) {
    sheet.appendRow([chatId]);
  }
}

function setState(chatId, state) {
  const cache = CacheService.getScriptCache();
  cache.put("state_" + chatId, state, 3600);
}

function getState(chatId) {
  const cache = CacheService.getScriptCache();
  return cache.get("state_" + chatId);
}

function clearState(chatId) {
  const cache = CacheService.getScriptCache();
  cache.remove("state_" + chatId);
}

function setUserData(chatId, key, value) {
  const cache = CacheService.getScriptCache();
  let data = cache.get("data_" + chatId);
  data = data ? JSON.parse(data) : {};
  data[key] = value;
  cache.put("data_" + chatId, JSON.stringify(data), 3600);
}

function getUserData(chatId) {
  const cache = CacheService.getScriptCache();
  const data = cache.get("data_" + chatId);
  return data ? JSON.parse(data) : {};
}

function clearUserData(chatId) {
  const cache = CacheService.getScriptCache();
  cache.remove("data_" + chatId);
}

// Salvar respostas na planilha SCRUM
function saveToSheet(chatId) {
  const sheet =
    SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const data = getUserData(chatId);

  sheet.appendRow([
    data.chatId || "",
    data.name || "",
    data.yesterday || "",
    data.today || "",
    data.blockers || "",
  ]);
}

// Enviar mensagem via Telegram API
function sendMessage(chatId, text) {
  if (!text || text.trim() === "") {
    Logger.log("sendMessage: mensagem vazia, não será enviada");
    return;
  }

  const url = `https://api.telegram.org/bot${TOKEN}/sendMessage`;
  const payload = {
    chat_id: chatId,
    text: text,
  };

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
  };

  UrlFetchApp.fetch(url, options);
}

// Função para enviar mensagem diária às 9h para todos os contatos
function sendDailyReminder() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONTACTS_SHEET_NAME);

  if (!sheet) {
    Logger.log("Aba CONTATOS não encontrada.");
    return;
  }

  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();

  data.forEach((row) => {
    const chatId = row[0];
    if (chatId) {
      sendMessage(
        chatId,
        'Bom dia! Vamos começar o SCRUM de hoje? Por favor, diga "Oi" para iniciar.'
      );
    }
  });
}
