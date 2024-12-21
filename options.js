console.log("Content script loaded");

// 讀取 keywords.json 文件
fetch(chrome.runtime.getURL('keywords.json'))
  .then(response => response.json())
  .then(keywordPairs => {
    console.log("Keywords loaded:", keywordPairs);
    // 替換一次關鍵字
    replaceKeywords(keywordPairs);

    // 註冊監聽每個按鈕的點擊事件
    registerButtonClickListener(keywordPairs);

    // 註冊滾動事件處理
    registerScrollListener(keywordPairs);
  })
  .catch(error => {
    console.error("Error loading keywords.json:", error);
  });

// 函數：替換關鍵字
async function replaceKeywords(keywordPairs) {
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

// 註冊對頁面上所有按鈕的點擊監聽
function registerButtonClickListener(keywordPairs) {
  const buttons = document.querySelectorAll('button');
  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      console.log("Button clicked. Replacing keywords...");
      replaceKeywords(keywordPairs);
    });
  });

  // 當頁面中有新加載的按鈕元素時，動態監聽
  const observer = new MutationObserver(() => {
    const newButtons = document.querySelectorAll('button:not([data-listener])');
    newButtons.forEach((button) => {
      button.setAttribute('data-listener', 'true'); // 添加標記避免重複綁定
      button.addEventListener('click', () => {
        console.log("New button clicked. Replacing keywords...");
        replaceKeywords(keywordPairs);
      });
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

// 註冊滾動事件處理器來在滾動時觸發刷新
let isScrolling = false;

function registerScrollListener(keywordPairs) {
  window.addEventListener('scroll', function () {
    if (!isScrolling) {
      isScrolling = true;
      console.log("Scroll detected. Replacing keywords...");
      
      // 使用防抖技術，等待滾動停止後再觸發
      setTimeout(async () => {
        await replaceKeywords(keywordPairs);
        isScrolling = false;
      }, 200);  // 200 毫秒延遲
    }
  });
}
