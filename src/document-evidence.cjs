// Page boundaries are retained locally. Only ranked passages enter the model prompt.
function documentFile(name, text, pdf = false) {
  if (text.length > 16_000_000) throw Error('This document contains more than 16 million characters. Split it into smaller files for local indexing.')
  const pages = pdf ? text.split('\f') : [text]
  const missing = pages.flatMap((p, i) => p.trim() ? [] : [i + 1])
  if (missing.length === pages.length) throw Error('No readable text was found in the file.')
  return { name, text: text.slice(0, 6000), pages, index: buildIndex(pages), partial: missing.length > 0, missing }
}
const terms = s => [...new Set(s.toLowerCase().match(/[\p{L}\d]+(?:[-_][\p{L}\d]+)*/gu) || [])]
function buildIndex(pages) {
  const offsets = [], postings = Object.create(null)
  for (const [page,text] of pages.entries()) {
    for (let at=0; at<text.length; at+=700) {
      const id=offsets.length
      offsets.push([page,at])
      for (const term of terms(text.slice(at,at+800))) {
        (postings['#'+term] ||= []).push(id)
      }
    }
  }
  return {offsets,postings}
}
function excerpts(file, question) {
  const pages=file.pages || [file.text]
  const {offsets,postings}=file.index || buildIndex(pages)
  const scores=new Map()
  for (const term of terms(question).filter(t=>t.length>2 && !['the','this','and','from','what','with','file','report'].includes(t))) {
    const matches=postings['#'+term] || []
    const weight=(/\d/.test(term)?4:1)*Math.log(1+offsets.length/(1+matches.length))
    for (const id of matches) scores.set(id,(scores.get(id)||0)+weight)
  }
  const ids=[...scores.keys()].sort((a,b)=>scores.get(b)-scores.get(a)||a-b).slice(0,6)
  for(let id=0;ids.length<6 && id<offsets.length;id++) if(!ids.includes(id)) ids.push(id)
  return {name:file.name,incompleteExtraction:!!file.partial,missingPages:file.missing,excerptsOnly:ids.length<offsets.length,
    passages:ids.sort((a,b)=>a-b).map(id=>{const [page,at]=offsets[id];return {page:page+1,text:pages[page].slice(at,at+800)}})}
}
function sourceLookup(file, question) {
  const id = /^(?:where (?:is|can i find)|find|locate|which page (?:contains|mentions))\s+(?:(?:the )?(?:refund|transaction|invoice)(?: for)?\s+)?["']?([a-z]+[-_]\d[\w-]*)["']?(?: in (?:the |this )?(?:pdf|document|file))?[?.!]?$/i.exec(question.trim())
  if (!id || !file.pages) return null
  const found = []
  for (const [i,page] of file.pages.entries()) {
    const line = page.split(/\r?\n/).find(line=>terms(line).includes(id[1].toLowerCase()))
    if (line) found.push('Page ' + (i+1) + ' — ' + line.trim().slice(0,240))
  }
  return {message:(found.length ? found.join('\n') : 'No match for ' + id[1] + ' in the readable text.') +
    (file.missing?.length ? '\nUnreadable pages: ' + file.missing.join(', ') + '.' : ''), actions:[]}
}
function needsVision(question, history = []) {
  if (/\b(colou?r(?:s|ed|ing)?|highlight(?:s|ed|ing)?|appearance|visual(?:ly)?|screenshot|pattern|shape|looks? like|depicted|drawn|farben?|couleurs?|colores?)\b|цвет|выгляд|изображ/iu.test(question)) return true
  return /^(?:and )?(?:what about (?:this|that)(?: one)?|how does it look)(?: now)?[?.!]?$/i.test(question.trim()) &&
    /colou?r|highlight|appearance|visual|shape|look like/i.test(history.filter(m=>m.role==='user').at(-1)?.text || '')
}
module.exports = {documentFile, excerpts, sourceLookup, needsVision}
