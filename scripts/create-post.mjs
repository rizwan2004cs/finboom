import https from 'https';

const projectId = 'ra4szzqu';
const dataset = 'production';
const token = process.env.SANITY_EDITOR_TOKEN || 'YOUR_EDITOR_TOKEN_HERE';

const post = {
  _type: 'post',
  title: "Fundamental Analysis: A Beginner's Guide to Reading Stocks Like a Pro",
  slug: { _type: 'slug', current: 'fundamental-analysis-beginners-guide' },
  category: 'guides',
  excerpt: "Learn the basics of fundamental analysis — from P/E ratios to debt-to-equity — explained simply so you can pick better stocks.",
  publishedAt: '2026-05-08T10:00:00Z',
  body: [
    { _type: 'block', _key: 'b1', style: 'h2', children: [{ _type: 'span', _key: 's1', text: 'What is Fundamental Analysis?' }] },
    { _type: 'block', _key: 'b2', style: 'normal', children: [{ _type: 'span', _key: 's2', text: "Imagine you're buying a business, not just a stock ticker. Fundamental analysis is exactly that — studying a company's financial health, earnings, and growth to decide if its stock price is fair, cheap, or expensive." }] },
    { _type: 'block', _key: 'b3', style: 'normal', children: [{ _type: 'span', _key: 's3', text: 'While technical analysis looks at charts and patterns, fundamental analysis looks at the business behind the stock. Think of it as checking the engine before buying a car.' }] },
    { _type: 'block', _key: 'b4', style: 'h2', children: [{ _type: 'span', _key: 's4', text: 'The Key Numbers You Need to Know' }] },
    { _type: 'block', _key: 'b5', style: 'h3', children: [{ _type: 'span', _key: 's5', text: '1. EPS (Earnings Per Share)' }] },
    { _type: 'block', _key: 'b6', style: 'normal', children: [{ _type: 'span', _key: 's6', text: "EPS tells you how much profit a company makes for each share you own. If a company earns \u20B9100 crore and has 10 crore shares, the EPS is \u20B910." }] },
    { _type: 'block', _key: 'b7', style: 'normal', markDefs: [], children: [
      { _type: 'span', _key: 's7a', text: 'Higher EPS = more profitable. But always compare EPS with companies in the ' },
      { _type: 'span', _key: 's7b', text: 'same industry', marks: ['strong'] },
      { _type: 'span', _key: 's7c', text: " \u2014 comparing Infosys with Tata Steel doesn't make sense." }
    ]},
    { _type: 'block', _key: 'b8', style: 'h3', children: [{ _type: 'span', _key: 's8', text: '2. P/E Ratio (Price-to-Earnings)' }] },
    { _type: 'block', _key: 'b9', style: 'normal', children: [{ _type: 'span', _key: 's9', text: "The P/E ratio is the most popular valuation metric. It tells you how much investors are willing to pay for \u20B91 of earnings." }] },
    { _type: 'block', _key: 'b10', style: 'normal', markDefs: [], children: [
      { _type: 'span', _key: 's10a', text: 'Formula: ' },
      { _type: 'span', _key: 's10b', text: 'P/E = Stock Price \u00F7 EPS', marks: ['strong'] }
    ]},
    { _type: 'block', _key: 'b11', style: 'normal', children: [{ _type: 'span', _key: 's11', text: "A P/E of 20 means investors pay \u20B920 for every \u20B91 the company earns. A low P/E might mean the stock is undervalued (or struggling). A high P/E could mean it's overvalued (or growing fast)." }] },
    { _type: 'block', _key: 'b12', style: 'blockquote', children: [{ _type: 'span', _key: 's12', text: "Pro tip: Nifty 50's average P/E hovers around 20-22. Stocks trading well above this need strong growth to justify the premium." }] },
    { _type: 'block', _key: 'b13', style: 'h3', children: [{ _type: 'span', _key: 's13', text: '3. P/B Ratio (Price-to-Book)' }] },
    { _type: 'block', _key: 'b14', style: 'normal', children: [{ _type: 'span', _key: 's14', text: "P/B compares the stock price with the company's book value (assets minus liabilities, per share). A P/B of 1 means you're paying exactly what the company's assets are worth on paper." }] },
    { _type: 'block', _key: 'b15', style: 'normal', children: [{ _type: 'span', _key: 's15', text: "P/B below 1? The stock might be a bargain \u2014 or the company might be in trouble. Banks and NBFCs are best evaluated using P/B since their main business is lending money." }] },
    { _type: 'block', _key: 'b16', style: 'h3', children: [{ _type: 'span', _key: 's16', text: '4. ROE (Return on Equity)' }] },
    { _type: 'block', _key: 'b17', style: 'normal', children: [{ _type: 'span', _key: 's17', text: "ROE measures how efficiently a company uses shareholders' money to generate profits. An ROE of 20% means the company generates \u20B920 of profit for every \u20B9100 of equity." }] },
    { _type: 'block', _key: 'b18', style: 'normal', markDefs: [], children: [
      { _type: 'span', _key: 's18a', text: 'Consistently high ROE (above 15%) is a sign of a ' },
      { _type: 'span', _key: 's18b', text: 'quality business', marks: ['strong'] },
      { _type: 'span', _key: 's18c', text: '. Think Asian Paints, TCS, or HDFC Bank.' }
    ]},
    { _type: 'block', _key: 'b19', style: 'h3', children: [{ _type: 'span', _key: 's19', text: '5. Debt-to-Equity Ratio (D/E)' }] },
    { _type: 'block', _key: 'b20', style: 'normal', children: [{ _type: 'span', _key: 's20', text: "This tells you how much debt the company has compared to its own money (equity). A D/E of 0.5 means for every \u20B9100 of equity, the company has \u20B950 of debt." }] },
    { _type: 'block', _key: 'b21', style: 'normal', children: [{ _type: 'span', _key: 's21', text: "Low D/E (below 1) is generally safer. High D/E isn't always bad \u2014 infra and real estate companies naturally carry more debt \u2014 but excessive debt during rising interest rates can crush profits." }] },
    { _type: 'block', _key: 'b22', style: 'h3', children: [{ _type: 'span', _key: 's22', text: '6. Revenue & Profit Growth' }] },
    { _type: 'block', _key: 'b23', style: 'normal', children: [{ _type: 'span', _key: 's23', text: "A company can have great ratios today but if revenue is shrinking, those ratios will deteriorate. Look for consistent revenue and profit growth over 3-5 years, not just one great quarter." }] },
    { _type: 'block', _key: 'b24', style: 'blockquote', children: [{ _type: 'span', _key: 's24', text: "One quarter doesn't make a trend. Always check at least 3 years of results before drawing conclusions." }] },
    { _type: 'block', _key: 'b25', style: 'h2', children: [{ _type: 'span', _key: 's25', text: 'Putting It All Together: A Quick Checklist' }] },
    { _type: 'block', _key: 'b26', style: 'normal', listItem: 'bullet', level: 1, children: [{ _type: 'span', _key: 's26', text: 'EPS growing year over year? \u2705' }] },
    { _type: 'block', _key: 'b27', style: 'normal', listItem: 'bullet', level: 1, children: [{ _type: 'span', _key: 's27', text: 'P/E reasonable compared to peers? \u2705' }] },
    { _type: 'block', _key: 'b28', style: 'normal', listItem: 'bullet', level: 1, children: [{ _type: 'span', _key: 's28', text: 'ROE consistently above 15%? \u2705' }] },
    { _type: 'block', _key: 'b29', style: 'normal', listItem: 'bullet', level: 1, children: [{ _type: 'span', _key: 's29', text: 'Debt-to-Equity under control? \u2705' }] },
    { _type: 'block', _key: 'b30', style: 'normal', listItem: 'bullet', level: 1, children: [{ _type: 'span', _key: 's30', text: 'Revenue and profit growing for 3+ years? \u2705' }] },
    { _type: 'block', _key: 'b31', style: 'normal', listItem: 'bullet', level: 1, children: [{ _type: 'span', _key: 's31', text: 'Business you understand? \u2705' }] },
    { _type: 'block', _key: 'b32', style: 'normal', children: [{ _type: 'span', _key: 's32', text: "If a stock checks most of these boxes, it's worth deeper research. If it fails multiple checks, move on \u2014 there are thousands of stocks out there." }] },
    { _type: 'block', _key: 'b33', style: 'h2', children: [{ _type: 'span', _key: 's33', text: 'Common Mistakes Beginners Make' }] },
    { _type: 'block', _key: 'b34', style: 'normal', markDefs: [], children: [{ _type: 'span', _key: 's34', text: 'Buying only because P/E is low.', marks: ['strong'] }] },
    { _type: 'block', _key: 'b35', style: 'normal', children: [{ _type: 'span', _key: 's35', text: "A low P/E can be a value trap \u2014 the stock might be cheap because the business is dying. Always check WHY the P/E is low." }] },
    { _type: 'block', _key: 'b36', style: 'normal', markDefs: [], children: [{ _type: 'span', _key: 's36', text: 'Ignoring debt.', marks: ['strong'] }] },
    { _type: 'block', _key: 'b37', style: 'normal', children: [{ _type: 'span', _key: 's37', text: "Companies like Vodafone Idea or Yes Bank looked great on revenue \u2014 until their debt became unmanageable. Always check D/E." }] },
    { _type: 'block', _key: 'b38', style: 'normal', markDefs: [], children: [{ _type: 'span', _key: 's38', text: 'Chasing one metric.', marks: ['strong'] }] },
    { _type: 'block', _key: 'b39', style: 'normal', children: [{ _type: 'span', _key: 's39', text: "No single number tells the full story. Use EPS, P/E, ROE, and D/E together to build a complete picture." }] },
    { _type: 'block', _key: 'b40', style: 'h2', children: [{ _type: 'span', _key: 's40', text: 'Start Tracking Your Picks' }] },
    { _type: 'block', _key: 'b41', style: 'normal', children: [{ _type: 'span', _key: 's41', text: "Once you've done your fundamental analysis and invested, the next step is tracking how your portfolio performs. FinBoom lets you track all your stocks, mutual funds, and 22+ asset classes in one place \u2014 so you always know your true net worth." }] },
    { _type: 'block', _key: 'b42', style: 'normal', children: [{ _type: 'span', _key: 's42', text: 'Import your Groww or Zerodha holdings in seconds and watch your wealth grow.' }] },
  ]
};

const mutations = [{ create: post }];
const body = JSON.stringify({ mutations });

const options = {
  hostname: projectId + '.api.sanity.io',
  path: '/v2024-01-01/data/mutate/' + dataset,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token,
    'Content-Length': Buffer.byteLength(body),
  },
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', data);
  });
});
req.on('error', (e) => console.error('Error:', e.message));
req.write(body);
req.end();
