// Scope decoder fields to the chosen operation. Grid bounds and edit semantics
// are checked against the live document when the plan is applied.
const string={type:'string'}, integer={type:'integer'}, boolean={type:'boolean'}
const target={type:'string',pattern:'^[A-Za-z]{1,3}[1-9][0-9]{0,4}(:[A-Za-z]{1,3}[1-9][0-9]{0,4})?$'}
const anchor={type:'string',pattern:'^[A-Za-z]{1,3}[1-9][0-9]{0,4}$'}
const color={type:'string',pattern:'^#[a-fA-F0-9]{6}$'}
const list=items=>({type:'array',minItems:1,items})
function variant(names, fields, required) {
  return {type:'object',properties:{op:{enum:names},sheet:string,...fields},required:['op',...required],additionalProperties:false}
}
const actions=[
  variant(['write'],{range:anchor,values:list(list({type:['string','number','boolean','null']}))},['range','values']),
  variant(['clear','bold','italic','merge','unmerge','filter'],{range:target},['range']),
  variant(['format'],{range:target,value:string},['range','value']),
  variant(['fill'],{range:target,value:color},['range','value']),
  variant(['align'],{range:target,value:{enum:['left','right','center']}},['range','value']),
  variant(['sort'],{range:target,index:integer,ascending:boolean},['range','index']),
  variant(['insertRows','deleteRows','insertColumns','deleteColumns','columnWidth','rowHeight','freezeRows','freezeColumns'],{index:integer,count:integer},['index','count']),
  variant(['addSheet','renameSheet'],{name:string},['name']),
  variant(['smiley'],{range:string,value:color},['range']),
  variant(['paintIcon'],{range:string,symbol:string},['range','symbol']),
  variant(['pixelArt'],{range:string,rows:list(string),palette:{type:'object',additionalProperties:color}},['range','rows','palette']),
]
module.exports={type:'json_schema',json_schema:{name:'report_plan',schema:{type:'object',additionalProperties:false,
  required:['message','actions'],properties:{message:string,actions:{type:'array',maxItems:50,items:{anyOf:actions}}}}}}
