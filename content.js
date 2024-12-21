console.log("Content script loaded");

// 遠程 JSON 文件 URL
const keywordsUrl = "https://raw.githubusercontent.com/nkxrfxforum/OrphanSavior/refs/heads/main/keywords.json";

// 函數：讀取關鍵字映射
async function fetchKeywords() {
  try {
    const response = await fetch(keywordsUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const keywordPairs = await response.json();
    console.log("Keywords loaded:", keywordPairs);
    return keywordPairs;
  } catch (error) {
    console.error("Error loading keywords:", error);
    return null; // 返回空，避免後續報錯
  }
}

// 函數：替換關鍵字
async function replaceKeywords(keywordPairs) {
  if (!keywordPairs) return; // 如果關鍵字映射為空，直接返回

  console.log("Starting keyword replacement...");

  // 使用分批處理方法替換關鍵字
  await replaceKeywordsInDocument(document, keywordPairs);

  // 處理 iframe 中的文本
  const iframes = document.getElementsByTagName('iframe');
  console.log("Found iframes:", iframes.length);
  for (let iframe of iframes) {
    try {
      const iframeDocument = iframe.contentDocument || iframe.contentWindow.document;
      if (iframeDocument) {
        await replaceKeywordsInDocument(iframeDocument, keywordPairs);
      }
    } catch (e) {
      console.log('Cannot access iframe content', e);
    }
  }
}

// 函數：替換頁面上的文本（分批處理）
function replaceKeywordsInDocument(doc, keywordPairs) {
  return new Promise((resolve) => {
    const textNodes = getTextNodes(doc.body);
    console.log("Found text nodes:", textNodes.length);

    let batchSize = 50; // 每批處理50個節點
    let index = 0;

    function processBatch() {
      const end = Math.min(index + batchSize, textNodes.length);
      for (; index < end; index++) {
        const node = textNodes[index];
        let text = node.nodeValue;
        for (let original in keywordPairs) {
          const replacement = keywordPairs[original];
          const regex = new RegExp(`\\b${original}\\b`, 'gi');
          if (regex.test(text)) {
            text = text.replace(regex, replacement);
          }
        }
        if (text !== node.nodeValue) {
          node.nodeValue = text;
        }
      }

      if (index < textNodes.length) {
        // 如果還有更多節點需要處理，請求下一個空閒時段繼續處理
        requestIdleCallback(processBatch);
      } else {
        resolve(); // 所有節點處理完成後，解決 Promise
      }
    }

    // 開始分批處理
    requestIdleCallback(processBatch);
  });
}

// 遍歷 DOM 取得所有文本節點
function getTextNodes(node) {
  let textNodes = [];
  if (node.nodeType === 3) { // 3 是文本節點
    textNodes.push(node);
  } else {
    node.childNodes.forEach((childNode) => {
      textNodes = textNodes.concat(getTextNodes(childNode));
    });
  }
  return textNodes;
}

// 每隔10秒檢查一次
setInterval(async () => {
  console.log("Fetching and checking for keyword replacements...");
  const keywordPairs = await fetchKeywords(); // 每次重新加載 JSON 文件
  await replaceKeywords(keywordPairs);
}, 10000); // 10秒鐘檢查一次
