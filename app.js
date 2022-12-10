const puppeteer = require('puppeteer');
const fs = require('fs');

const SUP_NEW_ITEM_URL = "https://www.supremenewyork.com/mobile/#categories/new";
  const SEARCH_WORD = "Crewneck";
  
  const ITEM_COLORS = [
    "Grey",
    "Black",
    "Dark Green",
    "Zebra",
    "Brown",
    "Blue",
    "Cardinal",
    "Pale Yellow",
  ];
  
  const BUY_LIST = [
    "Grey",
    "Black",
    "Dark Green",
    "Zebra",
    "Brown",
  ]
  
  const SIZE_LIST = [
    "Large",
    "Medium",
    "XLarge",
    "Small",
    "XXL"
  ];


const updateCart = async (page, itemColors, sizeList) => {
  
  const canBuyList = [];
  await page.waitForFunction(
    count => document.querySelectorAll("#style-selector > li").length >= count,
    {},
    itemColors.length
  );
  
  for (let i = 0; i < BUY_LIST.length; i++) {
    for (let j = 0; j < itemColors.length; j++) {
      const item = (await page.$$("#style-selector > li"))[j];
      await item.click();
        
      const eh = await page.waitForFunction(
        color => (
          document.querySelector("#style-name").textContent === color &&
          document.querySelector("#cart-update").textContent === "カートに入れる" &&
          document.querySelector("#size-options")
        ),
        {timeout: 100},
        BUY_LIST[i]
      ).then(eh => {
        return eh;
      }).catch(e => {
        return false;
      });
      if (eh === false) {
        continue;
      }
      
      const options = await eh.$$('#size-options > option');
      
      for (const size of sizeList) {
        for (const option of options) {
          if (await(await option.getProperty('textContent')).jsonValue() === size) {
            console.log(await(await option.getProperty('value')).jsonValue());
            await page.select('select[name="size-options"]', await(await option.getProperty('value')).jsonValue());
            await page.click('#cart-update > span');
            return true;
          }
        }
      }
    }
  }
  return canBuyList;
}

const getBuyItem = async (page, searchItemName) => {
  const searchResults = await page.$$("#products > ul > li");
  let buyItem;
  for (const item of searchResults) {
    const itemName = await (await item.getProperty('textContent')).jsonValue();
    if (itemName.toLowerCase().includes(searchItemName.toLowerCase())) {
      buyItem = item;
      break;
    }
  }
  return buyItem;
};

const newPage = async (browser, cookies) => {
  const page = await browser.newPage();
  await page.setCookie(...cookies);
  await page.setRequestInterception(true);
  page.on('request', request => {
    if (['font'].indexOf(request.resourceType()) !== -1) {
      request.abort();
    } else {
      request.continue();
    }
  });
  return page;
}

const getNewItem = async (browser, cookies) => {
  const page = await newPage(browser, cookies);
  while (true) {
    await page.goto(SUP_NEW_ITEM_URL);
    
    const buyItem = await getBuyItem(page, SEARCH_WORD);
    if (buyItem) {
      console.log("find!!!!");
      return {page, buyItem};
    }
    await mySleep(6);
    console.log("search retry");
  }
}

const launchBrowser = async () => {
  return await puppeteer.launch({
    args: [
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-setuid-sandbox',
      '--no-first-run',
      '--no-sandbox',
      '--no-zygote',
      '--single-process'
    ]
  });
}

const mySleep = (ms) => {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, ms)
  });
}


(async () => {
  
  const browser = await launchBrowser();
  const cookies = JSON.parse(fs.readFileSync('./cookies.json', 'utf-8'));
  
  const pageNum = 1;
  const getNewItemPromise = [];
  for (let i = 0; i < pageNum; i++) {
    getNewItemPromise.push(getNewItem(browser, cookies));
  }
  
  const { page, buyItem } = await Promise.race(getNewItemPromise);
  
  console.log(await (await buyItem.getProperty('textContent')).jsonValue());
  
  await buyItem.click();
  
  if (await updateCart(page, ITEM_COLORS, SIZE_LIST)) {
    
    await page.waitForFunction(
      () => (document.querySelector("#checkout-now").textContent === "ご注文手続きへ")
    );
    await page.waitForSelector("#checkout-now", {visible: true});
    
    await page.click("#checkout-now");
    
    await page.waitForFunction(
      () => (
        document.querySelector("#order_billing_name") &&
        document.querySelector("#order_email") &&
        document.querySelector("#order_tel") &&
        document.querySelector("#order_billing_zip") &&
        document.querySelector("#order_billing_state") &&
        document.querySelector("#order_billing_city") &&
        document.querySelector("#order_billing_address") &&
        document.querySelector("#payment_type_label_cod") &&
        document.querySelector("#order_terms")
      ),
    )
    
    await page.type('input[name="order[billing_name]"]', "XXXX XXXX");
    await page.type('input[name="order[email]"]', "xxxx@gxxx");
    await page.type('input[name="order[tel]"]', "xxxxxxx");
    
    await page.type('input[name="order[billing_zip]"]', "xxxxx", {delay: 50});
    await page.type('input[name="order[billing_city]"]', "XX市");
    await page.type('input[name="order[billing_address]"]', "XXXXXXX");
    await page.click('#payment_type_label_cod');
    await page.click("#order_terms");
    await page.screenshot({path: 'finish0.png', fullPage:true})
    await page.click("#submit_button");
  }
  
  await page.screenshot({path: 'finish1.png', fullPage:true})
  await mySleep(20000)
  await page.screenshot({path: 'finish2.png', fullPage:true})
  await browser.close();
})();

