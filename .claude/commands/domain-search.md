# Domain Search Command

## Description
Generate domain name ideas and check availability using whois lookup.

## Usage
```
/domain-search
```

## What it does
1. Asks user for their goals or name ideas for the new domain
2. Generates ~200 candidate domain name ideas and saves them to ideas.md
3. Checks availability of each domain using whois command
4. Creates a ranked list of best available domains

## Domain Generation Rules
- Keep names under 12 characters when possible
- Make them catchy, easy to remember and pronounce  
- 75% use .com suffix, 25% use alternate suffixes (.net, .io, .co, .biz, etc.)
- Only use alternate suffixes when they make sense for the product

## Implementation

Ask the user: "What are your goals or ideas for the new domain name? (e.g., business type, keywords, themes)"

Then follow these steps:

1. **Generate Ideas**: Create ~200 domain name candidates based on user input:
   - Single keywords with different TLDs
   - Keyword combinations 
   - Keywords with prefixes (get, my, the, go, use, try, find, best, quick, smart, easy, pro)
   - Keywords with suffixes (hub, zone, spot, base, link, way, lab, box, net, go)
   - Creative variations (remove vowels, add numbers)

2. **Check Availability**: For each domain, run `whois [domain]` to check if available:
   - Available domains typically return "No match", "Not found", or have no registrar info
   - Taken domains show registrar details, creation dates, etc.

3. **Rank Results**: Score domains based on:
   - Length (4-8 chars = best, up to 12 = good)
   - TLD (.com = 15pts, .io/.co/.app = 8pts, .net/.org = 5pts)  
   - Pronounceability (has vowels = +5pts)
   - Avoid numbers (-2pts) and consecutive consonants (-3pts)

4. **Generate Report**: Save final ranked list to ideas.md with:
   - Summary of total ideas vs available
   - Top available domains ranked by score
   - Complete list of all available domains

Always save progress to ideas.md and show top 5 recommendations at the end.
