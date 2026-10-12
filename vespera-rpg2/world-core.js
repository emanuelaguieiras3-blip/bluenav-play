(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./world-life') : root.WorldLife, typeof module === 'object' && module.exports ? require('./world-progress') : root.WorldProgress, typeof module === 'object' && module.exports ? require('./arena-core') : root.ArenaCore, typeof module === 'object' && module.exports ? require('./world-isekai') : root.WorldIsekai, typeof module === 'object' && module.exports ? require('./world-guild') : root.WorldGuild, typeof module === 'object' && module.exports ? require('./world-palace') : root.WorldPalace, typeof module === 'object' && module.exports ? require('./world-frontier') : root.WorldFrontier, typeof module === 'object' && module.exports ? require('./world-lair') : root.WorldLair, typeof module === 'object' && module.exports ? require('./world-trade') : root.WorldTrade, typeof module === 'object' && module.exports ? require('./world-adventurers') : root.WorldAdventurers);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Vespera = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Life, Progress, Arena, Isekai, Guild, Palace, Frontier, Lair, Trade, Adventurers) {
  'use strict';
  const SIZE = 256, TILE = 32, SPAWN = { x: 128.5, y: 130.5 };
  // The valley is SIZE x SIZE; the whole world (world-frontier.js) is 2560 x 2560 around it.
  const WORLD = Frontier ? Frontier.WORLD : { x0: 0, y0: 0, x1: SIZE, y1: SIZE }, inHeart = (x, y) => x >= 0 && y >= 0 && x < SIZE && y < SIZE;
  const classes = [
    { id:'guardiao', name:'Guardião', role:'DEFESA · CORPO A CORPO', color:'#7195b0', hp:150, mana:65, atk:15, def:8, speed:2.8, crit:.06, range:1.7, skill:'Muralha', effect:'shield', buff:'+50 vida · +4 defesa', debuff:'−20% velocidade · pouca mana', story:'Alguém precisa ser a última pessoa a recuar.' },
    { id:'guerreiro', name:'Guerreiro', role:'COMBATE · EQUILIBRADO', color:'#bc7458', hp:120, mana:80, atk:20, def:5, speed:3.5, crit:.1, range:1.8, skill:'Golpe sísmico', effect:'nova', buff:'+20 vida · +6 ataque', debuff:'Alcance curto · magia limitada', story:'Sua espada carrega marcas de caminhos que você não conta.' },
    { id:'arqueiro', name:'Arqueiro', role:'PRECISÃO · À DISTÂNCIA', color:'#88aa61', hp:90, mana:95, atk:16, def:2, speed:3.8, crit:.22, range:6, skill:'Chuva de flechas', effect:'nova', buff:'Alcance de 6m · +12% crítico', debuff:'−10 vida · −2 defesa', story:'Você escuta o galho quebrar antes de ver quem vem.' },
    { id:'mago', name:'Mago', role:'MAGIA · DANO EM ÁREA', color:'#9391d0', hp:75, mana:160, atk:23, def:1, speed:3.3, crit:.12, range:5, skill:'Explosão arcana', effect:'nova', buff:'+60 mana · +9 ataque', debuff:'−25 vida · −3 defesa', story:'Há respostas que só aparecem quando a pergunta pega fogo.' },
    { id:'ladino', name:'Ladino', role:'MOBILIDADE · CRÍTICO', color:'#9276a4', hp:85, mana:90, atk:17, def:2, speed:4.5, crit:.3, range:1.7, skill:'Passo das sombras', effect:'haste', buff:'+30% velocidade · 30% crítico', debuff:'−15 vida · defesa baixa', story:'Fechaduras são apenas sugestões feitas por outras pessoas.' },
    { id:'clerigo', name:'Clérigo', role:'SUPORTE · CURA', color:'#e2cb89', hp:105, mana:135, atk:11, def:5, speed:3.3, crit:.08, range:3, skill:'Luz restauradora', effect:'heal', buff:'Cura aliados próximos · +35 mana', debuff:'−3 ataque · movimento lento', story:'Você ainda acende uma vela para quem não voltou.' },
    { id:'druida', name:'Druida', role:'NATUREZA · REGENERAÇÃO', color:'#55a991', hp:100, mana:125, atk:14, def:3, speed:3.5, crit:.12, range:4, skill:'Sopro da floresta', effect:'heal', buff:'Regenera vida · +25 mana', debuff:'−1 defesa · dano moderado', story:'As raízes reconhecem seus passos. Nem todas gostam de você.' },
    { id:'berserker', name:'Berserker', role:'FÚRIA · ALTO RISCO', color:'#c56861', hp:135, mana:60, atk:27, def:0, speed:3.6, crit:.17, range:1.8, skill:'Fúria vermelha', effect:'rage', buff:'+13 ataque · +35 vida', debuff:'Sem defesa base · fúria custa vida', story:'Sua raiva tem um nome. Você ainda não o disse em voz alta.' },
    { id:'paladino', name:'Paladino', role:'PROTEÇÃO · CURA', color:'#c3ad62', hp:135, mana:110, atk:15, def:7, speed:2.9, crit:.08, range:1.9, skill:'Juramento solar', effect:'heal', buff:'+35 vida · +3 defesa · cura', debuff:'−17% velocidade · crítico baixo', story:'O juramento continua valendo, mesmo sem ninguém para cobrar.' },
    { id:'necromante', name:'Necromante', role:'DRENAGEM · À DISTÂNCIA', color:'#81a18a', hp:80, mana:145, atk:21, def:1, speed:3.4, crit:.15, range:4.5, skill:'Colheita de almas', effect:'drain', buff:'Rouba vida · +45 mana', debuff:'−20 vida · −3 defesa', story:'Os mortos não são silenciosos. Só estão cansados de repetir.' },
    { id:'bardo', name:'Bardo', role:'SUPORTE · VELOCIDADE', color:'#ce9470', hp:95, mana:125, atk:12, def:3, speed:4, crit:.18, range:3.5, skill:'Canção da estrada', effect:'haste', buff:'Acelera o grupo · +25 mana', debuff:'−2 ataque · −5 vida', story:'Toda vila tem uma canção que jura ter inventado.' },
    { id:'monarca', name:'Monarca das Sombras', role:'INVOCAÇÃO · SOMBRAS', color:'#7a5cff', hp:100, mana:130, atk:18, def:3, speed:3.8, crit:.16, range:1.7, skill:'Ergam-se!', effect:'arise', buff:'Levanta os monstros abatidos como soldados das sombras', debuff:'Frágil sozinho · −10 vida · −2 defesa', story:'Você foi o mais fraco da masmorra. Algo lá embaixo decidiu que isso ia mudar.' },
    { id:'artifice', name:'Artífice', role:'COLETA · CONSTRUÇÃO', color:'#c09860', hp:110, mana:100, atk:14, def:5, speed:3.2, crit:.1, range:2.5, skill:'Campo de proteção', effect:'shield', buff:'Coleta +1 recurso · +10 vida', debuff:'−9% velocidade · alcance médio', story:'Se não existe uma ferramenta para isso, você vai fazer uma.' }
  ];
  const classById = Object.fromEntries(classes.map(c => [c.id,c]));
  // Famílias: as oito jogáveis são sorteadas como sobrenome; as demais são linhagens dos chefes.
  const houses = [
    { id:'salgueiro', surname:'Salgueiro', noble:true, playable:true, title:'Casa Salgueiro', rank:'Nobreza fundadora', status:'Nobre', color:'#6f9a63', sigil:'❦', motto:'Raízes fundas, galhos abertos.', seat:{name:'Solar Salgueiro',x:110,y:112}, lore:'Fundaram a vila às margens do poço e ainda guardam a primeira carta de Íria. Governam com mais conselhos do que ordens.' },
    { id:'luar', surname:'Luar', noble:true, playable:true, title:'Casa Luar', rank:'Nobreza antiga', status:'Nobre', color:'#8c95c9', sigil:'☾', motto:'A noite também tem herdeiros.', seat:{name:'Torre dos Luar',x:192,y:104}, lore:'Astrônomos da floresta temperada. Dizem que cada filho da casa nasce com uma estrela a menos no céu.' },
    { id:'brum', surname:'Brum', noble:true, playable:true, title:'Casa Brum', rank:'Nobreza das montanhas', status:'Nobre', color:'#9fb4bf', sigil:'⛰', motto:'O frio não dobra a pedra.', seat:{name:'Fortaleza Brum',x:36,y:212}, lore:'Senhores das passagens alpinas e do farol de Pedralva. Cobram pedágio em sal e em histórias.' },
    { id:'ferraz', surname:'Ferraz', noble:true, playable:true, title:'Casa Ferraz', rank:'Nobreza mercante', status:'Nobre', color:'#d0a45a', sigil:'⚜', motto:'Todo ouro já foi areia.', seat:{name:'Palácio das Dunas',x:140,y:226}, lore:'Enriqueceram escavando o Observatório Soterrado. Compram títulos com a mesma calma com que compram camelos.' },
    { id:'vale', surname:'Vale', noble:false, playable:true, title:'Família Vale', rank:'Gente do campo', status:'Plebeia', color:'#8eab6b', sigil:'✿', motto:'Quem planta, volta.', seat:{name:'Sítio dos Vale',x:200,y:186}, lore:'Lavradores do pantanal. Conhecem cada trilha seca entre as lanternas e nunca deixaram um viajante sem sopa.' },
    { id:'vilar', surname:'Vilar', noble:false, playable:true, title:'Família Vilar', rank:'Pescadores e barqueiros', status:'Plebeia', color:'#6ea3b3', sigil:'⚓', motto:'A maré sempre devolve.', seat:{name:'Cabana dos Vilar',x:30,y:134}, lore:'Barqueiros que atravessam os rios da floresta densa. Levam cartas, segredos e às vezes gente que não quer ser encontrada.' },
    { id:'moura', surname:'Moura', noble:false, playable:true, title:'Família Moura', rank:'Ferreiros e mineiros', status:'Plebeia', color:'#b87a5c', sigil:'⚒', motto:'Brasa paciente faz aço bom.', seat:{name:'Oficina dos Moura',x:80,y:62}, lore:'Mineiros da savana que forjaram as primeiras correntes do Portal das Cinzas. Bento aprendeu o ofício com eles.' },
    { id:'cardoso', surname:'Cardoso', noble:false, playable:true, title:'Família Cardoso', rank:'Caçadores da taiga', status:'Plebeia', color:'#a08a6a', sigil:'➶', motto:'Pegada fresca, flecha pronta.', seat:{name:'Acampamento Cardoso',x:204,y:56}, lore:'Caçadores e guias dos lagos frios. Contam os invernos pelas cicatrizes deixadas pelos lobos.' },
    { id:'espinheiro', surname:'Espinheiro', noble:true, playable:false, title:'Casa Espinheiro', rank:'Nobreza caída', status:'Nobre caída', color:'#7ea35a', sigil:'✥', motto:'O que é nosso, cresce.', lore:'Barões que tentaram possuir a floresta. A floresta aceitou, e os possuiu de volta.' },
    { id:'valcinza', surname:'Valcinza', noble:true, playable:false, title:'Casa Valcinza', rank:'Nobreza caída', status:'Nobre caída', color:'#d9795a', sigil:'♨', motto:'Das cinzas, a coroa.', lore:'Condes que abriram o Portal das Cinzas para aquecer seus salões. O fogo nunca mais aceitou voltar.' },
    { id:'pedrafria', surname:'Pedrafria', noble:false, playable:false, title:'Família Pedrafria', rank:'Ferreiros do inverno', status:'Plebeia', color:'#9cc7da', sigil:'❄', motto:'Martelo, bigorna, silêncio.', lore:'Ferreiros plebeus que forjaram armas para a Casa Brum. Traídos no pagamento, juraram forjar o próprio inverno.' },
    { id:'juncal', surname:'Juncal', noble:false, playable:false, title:'Família Juncal', rank:'Contrabandistas do lodo', status:'Plebeia', color:'#8f9d6a', sigil:'≈', motto:'Nenhum barco volta vazio.', lore:'Contrabandistas do pantanal que escondiam cargas sob as águas. A lama guardou a matriarca junto com os tesouros.' },
    { id:'aurora', surname:'Aurora', noble:true, playable:false, title:'Casa Aurora', rank:'Nobreza extinta', status:'Nobre extinta', color:'#bb9ce0', sigil:'✧', motto:'Lembrem de nós.', lore:'A primeira dinastia do vale. Todos os nomes foram apagados, menos um: o do Último Esquecido.' }
  ];
  const houseById = Object.fromEntries(houses.map(h => [h.id,h]));
  const playableHouses = houses.filter(h => h.playable);
  function familyOf(p){const surname=typeof p==='string'?p:p?.surname;return houses.find(h=>h.surname===surname)||{id:'sem-casa',surname:surname||'',noble:false,playable:false,title:'Família '+(surname||'sem nome'),rank:'Linhagem desconhecida',status:'Plebeia',color:'#a99b7a',sigil:'•',motto:'O caminho também escolhe.',lore:'Uma família cuja história ainda não foi escrita.'};}
  function honorific(p){if(!familyOf(p).noble)return '';return p.appearance==='male'?'Lorde':'Dama';}
  function fullName(p){return [honorific(p),p.name,p.surname].filter(Boolean).join(' ');}
  function familyPerk(p){return familyOf(p).noble?'Renda nobre: +50% de moedas de monstros, +10 reputação por raide e descanso completo no solar da casa.':'Mãos do povo: coletas e mineração dão mais EXP, raides rendem +2 minérios e contratos dão 1 poção extra.';}
  const biomes = [
    {name:'Campos do Vale',sub:'Pradarias, flores e salgueiros',color:'#718451',dark:'#4e633a',level:1,monster:'slime',surface:'meadow',trees:.09,rocks:.025},
    {name:'Floresta Temperada',sub:'Carvalhos, solo úmido e clareiras',color:'#627647',dark:'#344c31',level:2,monster:'wolf',surface:'forest',trees:.24,rocks:.03},
    {name:'Pantanal',sub:'Águas rasas, lama e vegetação ribeirinha',color:'#727956',dark:'#455e3d',level:3,monster:'wisp',surface:'wetland',trees:.11,rocks:.015},
    {name:'Deserto',sub:'Dunas, arenito e vegetação escassa',color:'#c3aa79',dark:'#8a7955',level:4,monster:'scarab',surface:'sand',trees:.012,rocks:.08},
    {name:'Montanhas Alpinas',sub:'Neve, granito e pinheiros',color:'#c6cbc5',dark:'#747f77',level:5,monster:'ice',surface:'snow',trees:.075,rocks:.17},
    {name:'Floresta Densa',sub:'Copas fechadas e chão coberto de folhas',color:'#536647',dark:'#293f30',level:6,monster:'necromancer',surface:'forest',trees:.29,rocks:.035},
    {name:'Savana',sub:'Capim seco, acácias e afloramentos rochosos',color:'#a49c69',dark:'#716f42',level:7,monster:'ember',surface:'savanna',trees:.045,rocks:.055},
    {name:'Taiga',sub:'Floresta de coníferas e lagos frios',color:'#69735a',dark:'#3b5141',level:8,monster:'wolf',surface:'taiga',trees:.19,rocks:.075}
  ];
  const materials = ['Cobre','Estanho','Ferro','Bronze','Prata','Ouro','Quartzo','Jade','Obsidiana','Ametista','Safira','Rubi','Mithril','Cristal lunar','Âmbar antigo','Estelita'];
  const materialColors = ['#be8159','#acb4b5','#8e9fa3','#b09153','#d7dce0','#e9c35e','#ecdacc','#70bc9a','#797189','#ab80ce','#719bda','#da797b','#7dcad1','#ccd6ed','#dea561','#bcb0eb'];
  const families = [
    ['espada','Espada','weapon',8,0,0,0,1.8],['machado','Machado','weapon',11,0,0,-.12,1.6],['adaga','Adaga','weapon',5,0,0,.12,1.4],['lanca','Lança','weapon',7,0,0,0,2.6],
    ['arco','Arco','weapon',6,0,0,0,6],['cajado','Cajado','weapon',9,0,8,0,5],['martelo','Martelo','weapon',12,0,0,-.16,1.5],['foice','Foice','weapon',8,0,0,0,2.2],
    ['peitoral','Peitoral','armor',0,5,12,-.06,0],['tunica','Túnica','armor',1,2,6,0,0],['manto','Manto','armor',2,1,4,.07,0],
    ['elmo','Elmo','head',0,3,8,0,0],['capuz','Capuz','head',1,1,4,.04,0],['botas','Botas','feet',0,2,0,.15,0],['grevas','Grevas','feet',0,4,4,-.04,0],
    ['anel','Anel','charm',3,0,0,0,0],['amuleto','Amuleto','charm',0,1,14,0,0],['broche','Broche','charm',1,2,6,.05,0]
  ];
  const items = {}, recipes = [];
  function add(item) { items[item.id] = item; }
  const resources = [ ['wood','Madeira','#b88959'],['stone','Pedra','#a6b0b0'],['fiber','Fibra','#a2b078'],['herb','Erva de cura','#79b389'],['berry','Amora silvestre','#ae708d'],['slime','Geleia de limo','#88bd87'],['leather','Couro','#af8c69'],['essence','Essência','#a399d5'],['coal','Carvão','#646678'],['fish','Peixe do vale','#7cbbcb'],['seed','Semente de trigo','#d9c184'],['wheat','Trigo','#e4c570'] ];
  resources.forEach(([id,name,color])=>add({id,name,color,type:'resource',tier:1,desc:'Ingrediente de fabricação. Encontrado explorando, coletando ou combatendo.'}));
  if(Trade)Trade.items.forEach(({id,name,value})=>add({id,name,type:'loot',tier:1,value,color:value>=100?'#e8c14a':value>=40?'#c98ad8':'#b8a080',desc:`Parte de monstro. A guilda compra por cerca de ${value} moedas (o preço cai quando muita gente vende a mesma coisa no dia).`}));
  materials.forEach((name,i)=> {
    add({id:'ore'+i,name:'Minério de '+name.toLowerCase(),type:'resource',color:materialColors[i],tier:Math.floor(i/2)+1,desc:`Encontrado em rochas de ${biomes[Math.floor(i/2)].name}.`});
    families.forEach(([key,label,slot,atk,def,hp,speed,range])=> {
      const tier=Math.floor(i/2)+1,id=`${key}-${i}`;
      const item={id,name:`${label} de ${name.toLowerCase()}`,type:'equipment',slot,tier,color:materialColors[i],atk:atk?atk+tier*2+(i%2):0,def:def?def+tier:0,hp:hp?hp+tier*2:0,speed,range,crit:key==='adaga'?.08:key==='arco'?.04:0,desc:`${label} forjado em ${name.toLowerCase()}. ${slot==='weapon'?'Altera o alcance do ataque.':'Concede atributos enquanto equipado.'}`};
      add(item); recipes.push({id,cost:{['ore'+i]:tier+2,wood:slot==='weapon'?3:1,fiber:slot==='weapon'?1:3},station:'forge'});
    });
  });
  const consumables=[['potion','Poção de vida','#d57a7b','heal',50,{herb:3,berry:1}],['mana','Tônico de mana','#779ed4','mana',65,{herb:2,essence:1}],['soup','Sopa do viajante','#d6a86b','heal',90,{fish:1,herb:2}],['elixir','Elixir de vigor','#95c486','haste',20,{berry:3,slime:2}],['bread','Pão rústico','#d8b57d','heal',35,{wheat:2}],['antidote','Antídoto','#ad89cb','cleanse',1,{herb:2,slime:1}],['bomb','Bomba de carvão','#9f8e85','bomb',65,{coal:3,stone:3}],['tonic','Tônico de força','#c68e64','rage',20,{leather:2,berry:3}]];
  consumables.forEach(([id,name,color,effect,power,cost])=>{add({id,name,type:'consumable',tier:1,color,effect,power,desc:effect==='heal'?`Recupera ${power} de vida.`:effect==='mana'?`Recupera ${power} de mana.`:effect==='haste'?'Aumenta a velocidade por 20 segundos.':effect==='rage'?'Aumenta o ataque por 20 segundos.':effect==='bomb'?'Causa 65 de dano em inimigos próximos.':'Remove veneno e lentidão.'});recipes.push({id,cost,station:'any'});});
  [['campfire','Fogueira','#d39266',{wood:8,stone:4}],['fence','Cerca de madeira','#b08d5c',{wood:3}],['lantern','Lanterna','#e0c274',{wood:3,ore0:2}],['bench','Banco de jardim','#b59a76',{wood:5,fiber:2}]].forEach(([id,name,color,cost])=>{add({id,name,type:'building',tier:1,color,desc:'Use para colocar no terreno livre à sua frente.'});recipes.push({id,cost,station:'any'});});
  const landmarks=[
    {id:'village',name:'Vila Salgueiro',x:128,y:128,kind:'town'},
    {id:'forge',name:'Forja de Bento',x:122,y:127,kind:'forge'},
    {id:'inn',name:'Pouso da Andorinha',x:133,y:123,kind:'inn'},
    {id:'elder',name:'Íria, a cartógrafa',x:128,y:125,kind:'npc'},
    {id:'well',name:'Poço das Promessas',x:128,y:133,kind:'well'},
    {id:'chest',name:'Baú do viajante',x:124,y:132,kind:'chest'},
    {id:'farm',name:'Horta comunitária',x:137,y:131,kind:'farm'},
    {id:'amber',name:'Altar de Âmbar',x:151,y:112,kind:'shrine'},
    {id:'marsh',name:'Círculo das Lanternas',x:168,y:167,kind:'shrine'},
    {id:'dunes',name:'Observatório Soterrado',x:125,y:208,kind:'shrine'},
    {id:'frost',name:'Torre da Geada',x:51,y:201,kind:'shrine'},
    {id:'forgotten',name:'Biblioteca das Raízes',x:39,y:118,kind:'shrine'},
    {id:'cinder',name:'Portal das Cinzas',x:61,y:46,kind:'shrine'},
    {id:'stars',name:'Santuário das Estrelas',x:170,y:43,kind:'boss'}
  ];
  // Underground rooms occupy sealed map regions; coordinates remain compatible with saves and LAN.
  const expeditions=[
    {id:'copper-cave',name:'Gruta do Cobre',kind:'cave',x:145,y:128,rx:4,ry:4,w:24,h:22,tier:0},
    {id:'crystal-cave',name:'Caverna dos Cristais',kind:'cave',x:88,y:128,rx:34,ry:4,w:24,h:22,tier:5},
    {id:'totem-citadel',name:'Cidadela do Totem',kind:'citadel',x:128,y:150,rx:64,ry:4,w:118,h:34,tier:6}
  ];
  expeditions.push(
    {id:'goblin-depths',name:'Mina Goblin · profundidade II',kind:'cave',x:46,y:7,rx:4,ry:58,w:30,h:28,tier:5,depth:2},
    {id:'ancient-depths',name:'Fenda Ancestral · profundidade III',kind:'cave',x:19,y:61,rx:40,ry:58,w:32,h:30,tier:7,depth:3}
  );
  // Portais: raid dungeons (3 waves + boss) ranked E..S, scattered over the valley. Interiors sit east of the world.
  const gates=[
    {id:'gate-limos',name:'Portal Cinzento · Rank E',rank:'E',x:168,y:144,tier:1,boss:'slimeKing',waves:[['slime','slime','slime'],['slime','mushroom','slime']]},
    {id:'gate-almas',name:'Cripta das Almas · Rank E',rank:'E',x:90,y:108,tier:2,boss:'soulWarden',waves:[['skeleton','skeleton','wraith'],['necromancer','skeleton','wraith']]},
    {id:'gate-colonia',name:'Portal Verde · Rank D',rank:'D',x:126,y:237,tier:3,boss:'antKing',waves:[['antSoldier','antSoldier','antSoldier'],['antSoldier','scarab','antSoldier']]},
    {id:'gate-gelo',name:'Portal Azul · Rank C',rank:'C',x:87,y:228,tier:5,boss:'frostBoss',waves:[['iceElf','ice','iceElf'],['ice','iceElf','gargoyle']]},
    {id:'gate-pantano',name:'Portal do Pântano · Rank C',rank:'C',x:234,y:228,tier:5,boss:'spiderQueen',waves:[['lizardman','naga','lizardman'],['naga','wisp','naga']]},
    {id:'gate-orc',name:'Portal Vermelho · Rank B',rank:'B',x:117,y:42,tier:7,boss:'minotaurKing',waves:[['orc','hellhound','orc'],['minotaur','orc','harpy']]},
    {id:'gate-castelo',name:'Castelo Sombrio · Rank A',rank:'A',x:18,y:144,tier:8,boss:'bloodKnight',waves:[['skeleton','wraith','skeleton'],['gargoyle','dragonkin','gargoyle']]},
    {id:'gate-demonio',name:'Fenda do Demônio · Rank S',rank:'S',x:36,y:30,tier:9,boss:'demonLord',waves:[['hellhound','demon','hellhound'],['dragonkin','demon','dragonkin']]}
  ];
  gates.forEach((g,i)=>expeditions.push({...g,kind:'raid',rx:3700+i*30,ry:0,w:24,h:22}));
  const npcDefs=[
    {id:'elder',name:'Íria, a cartógrafa',classId:'clerigo',role:'quest',path:[[128.5,125.5],[130.5,125.5],[130.5,128.5],[128.5,128.5]],speed:.45},
    {id:'miner',name:'Téo, o prospector',classId:'artifice',role:'talk',path:[[121.5,128.5],[125.5,128.5]],speed:.6,text:'A Caverna dos Cristais esconde uma descida ao norte. Lá embaixo, goblins guardam veios raros. O terceiro andar é ainda mais profundo.'},
    {id:'scout',name:'Nara, a patrulheira',classId:'arqueiro',role:'talk',path:[[128.5,136.5],[128.5,132.5]],speed:.7,text:'A Cidadela do Totem fica ao sul da vila. Quatro alas, quatro totens e quatro chefes guardam o Grande Totem. Quebre o totem de cada ala antes de enfrentar o chefe.'}
  ];
  function npcPosition(n,time){const lengths=n.path.map((a,i)=>Math.hypot(a[0]-n.path[(i+1)%n.path.length][0],a[1]-n.path[(i+1)%n.path.length][1])),total=lengths.reduce((a,b)=>a+b,0);if(!total)return {...n,x:n.path[0][0],y:n.path[0][1],dir:n.face??0,idle:true};let d=(Math.max(0,time)*n.speed)%total;
    for(let i=0;i<n.path.length;i++){if(d<=lengths[i]){const a=n.path[i],b=n.path[(i+1)%n.path.length],t=d/lengths[i];return {...n,x:a[0]+(b[0]-a[0])*t,y:a[1]+(b[1]-a[1])*t,dir:Math.abs(b[0]-a[0])>Math.abs(b[1]-a[1])?(b[0]>a[0]?2:1):(b[1]>a[1]?0:3)};}d-=lengths[i];}return {...n,x:n.path[0][0],y:n.path[0][1],dir:0};}
  function npcsAt(w,p){const list=npcDefs.map(n=>{const a=w.life?.npcs?.[n.id];return a?{...n,...a,text:Life.describe(n,w)}:npcPosition(n,w.time);});return Adventurers?list.concat(Adventurers.list(w,p)):list;}
  function npcNear(w,p){const place=landmarkAt(p.x,p.y,2.3);return npcsAt(w,p).filter(n=>!n.inside&&Math.hypot(n.x-p.x,n.y-p.y)<2.3&&!(n.adventurer&&place)).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];}
  const attributeDefs={strength:{name:'Força',short:'FOR',desc:'+2 ataque'},agility:{name:'Agilidade',short:'AGI',desc:'+0,06 velocidade, +0,5% crítico'},vitality:{name:'Vigor',short:'VIT',desc:'+10 vida, +0,5 defesa'},spirit:{name:'Inteligência',short:'INT',desc:'+8 mana'},perception:{name:'Percepção',short:'PER',desc:'+1% crítico, +0,05 alcance'}};
  function attributePoints(p){return Math.max(0,3+(p.level-1)*2+(p.system?.bonus||0)-Object.values(p.attributes||{}).reduce((a,b)=>a+b,0));}
  // Cada raide tem ondas temáticas e um chefe próprio (definido em monsterTypes).
  const raidPlans={
    'root-raid':{boss:'rootBoss',waves:[['slime','wolf','slime'],['wolf','necromancer','wolf']]},
    'ash-raid':{boss:'ashBoss',waves:[['ember','wisp','ember'],['necromancer','ember','scarab']]},
    'frost-raid':{boss:'frostBoss',waves:[['wolf','ice','wolf'],['ice','necromancer','ice']]},
    'tide-raid':{boss:'tideBoss',waves:[['slime','wisp','slime'],['wisp','scarab','wisp']]}
  };
  for(const d of expeditions)if(raidPlans[d.id])Object.assign(d,raidPlans[d.id]);
  // ---------- Abismo de Véspera: caverna grande com salões, lago, magma e covis ----------
  const abyss={id:'abyss',name:'Abismo de Véspera',kind:'deep',x:222,y:62,rx:186,ry:4,w:66,h:46,tier:7};
  expeditions.push(abyss);
  const abyssAreas=[
    {id:'hall',name:'Salão das Tochas',sub:'A entrada. Tochas antigas ainda queimam sozinhas.',x:33,y:39,rx:7.5,ry:5,theme:'hall'},
    {id:'lake',name:'Lago Negro',sub:'Água parada e fria. Algo brilha no fundo.',x:33,y:24,rx:10.5,ry:6,theme:'lake'},
    {id:'crystal',name:'Galeria dos Cristais',sub:'Veios de safira, rubi e ametista.',x:12,y:30,rx:8.5,ry:6.5,theme:'crystal'},
    {id:'mushroom',name:'Bosque dos Cogumelos',sub:'Cogumelos luminosos. Colha com E.',x:54,y:28,rx:8.5,ry:6.5,theme:'mushroom'},
    {id:'web',name:'Covil da Tecelã',sub:'Teias grossas cobrem as paredes.',x:11,y:11,rx:7.5,ry:5.5,theme:'web',lair:'spiderQueen'},
    {id:'geode',name:'Covil do Colosso',sub:'Um geodo gigante. Algo se mexe entre os cristais.',x:55,y:11,rx:7.5,ry:5.5,theme:'geode',lair:'colossus'},
    {id:'roost',name:'Ninho de Vesperalba',sub:'O teto está coberto de asas.',x:56,y:40.5,rx:7,ry:3.8,theme:'roost',lair:'batQueen'},
    {id:'magma',name:'Coração de Magma',sub:'O calor queima o ar. Ignarok dorme aqui.',x:33,y:7.5,rx:10,ry:4.6,theme:'magma',lair:'wyrm'}
  ];
  const abyssTunnels=[['hall','lake',2],['lake','crystal',1.7],['lake','mushroom',1.7],['crystal','web',1.6],['mushroom','geode',1.6],['mushroom','roost',1.6],['lake','magma',1.9],['hall','roost',1.4]];
  const abyssGuardians=['spiderQueen','colossus','batQueen'];
  const abyssGrid=(()=>{
    const W=abyss.w,H=abyss.h,grid=new Array(W*H).fill(null),area=id=>abyssAreas.find(a=>a.id===id);
    const oval=(a,x,y)=>((x+.5-a.x)/a.rx)**2+((y+.5-a.y)/a.ry)**2;
    for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){const a=abyssAreas.find(a=>oval(a,x,y)<1+(hash(x,y,991)-.5)*.3);if(a)grid[y*W+x]={kind:'cavefloor',area:a.id,theme:a.theme};}
    for(const [from,to,width] of abyssTunnels){const a=area(from),b=area(to),len=Math.hypot(b.x-a.x,b.y-a.y),nx=-(b.y-a.y)/len,ny=(b.x-a.x)/len;
      for(let t=0;t<=1;t+=.5/len){const wig=Math.sin(t*Math.PI*2+a.x*.3)*2.2*Math.sin(t*Math.PI),cx=a.x+(b.x-a.x)*t+nx*wig,cy=a.y+(b.y-a.y)*t+ny*wig;
        for(let y=Math.floor(cy-width-1);y<=cy+width+1;y++)for(let x=Math.floor(cx-width-1);x<=cx+width+1;x++){if(x<1||y<1||x>=W-1||y>=H-1)continue;if(Math.hypot(x+.5-cx,y+.5-cy)<=width&&!grid[y*W+x])grid[y*W+x]={kind:'cavefloor',area:'tunnel',theme:'tunnel',tunnel:from+'-'+to};}}}
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){const c=grid[y*W+x];if(!c){grid[y*W+x]={kind:'wall',theme:'wall'};continue;}
      const a=area(c.area),n=hash(x,y,4242),o=a?oval(a,x,y):1;
      if(c.tunnel==='lake-magma'&&y>=12&&y<=13){c.kind='seal';continue;}
      if(c.area==='lake'&&o<.42){c.kind='water';continue;}
      if(c.area==='magma'&&(((x+.5-25)/3.2)**2+((y+.5-7)/1.7)**2<1||((x+.5-41)/3.2)**2+((y+.5-7)/1.7)**2<1)){c.kind='lava';continue;}
      if(a&&o>.45&&o<.95&&!a.lair&&c.area!=='hall'&&n>.955){c.kind='stal';continue;}
      if(c.area==='crystal'&&o>.3&&n>.84){c.kind='rock';c.ore=8+Math.floor(hash(x,y,77)*4);continue;}
      if(c.area==='geode'&&o>.55&&n>.8){c.kind='rock';c.ore=9;continue;}
      if(c.area==='hall'&&o>.55&&n>.9){c.kind='rock';c.ore=Math.floor(hash(x,y,31)*4);continue;}
      if(c.area==='mushroom'&&o>.18&&n>.78){c.kind='mushroom';continue;}
      if(c.area==='tunnel'&&n>.975){c.kind='mushroom';continue;}
    }
    // Corredor livre ao longo de cada túnel: decoração nunca bloqueia o caminho.
    for(const [from,to] of abyssTunnels){const a=area(from),b=area(to),len=Math.hypot(b.x-a.x,b.y-a.y),nx=-(b.y-a.y)/len,ny=(b.x-a.x)/len;for(let t=0;t<=1;t+=.4/len){const wig=Math.sin(t*Math.PI*2+a.x*.3)*2.2*Math.sin(t*Math.PI),cx=a.x+(b.x-a.x)*t+nx*wig,cy=a.y+(b.y-a.y)*t+ny*wig;for(let y=Math.floor(cy-2);y<=cy+2;y++)for(let x=Math.floor(cx-2);x<=cx+2;x++){const c=grid[y*W+x];if(c&&['stal','rock'].includes(c.kind)&&Math.hypot(x+.5-cx,y+.5-cy)<1.6){c.kind='cavefloor';delete c.ore;}}}}
    return grid;
  })();
  function abyssCell(x,y){x=Math.floor(x)-abyss.rx;y=Math.floor(y)-abyss.ry;if(x<0||y<0||x>=abyss.w||y>=abyss.h)return null;return abyssGrid[y*abyss.w+x];}
  function abyssArea(x,y){const c=abyssCell(x,y);if(!c)return null;return abyssAreas.find(a=>a.id===c.area)||{id:'tunnel',name:'Túneis do Abismo',sub:'Passagens estreitas entre os salões.',theme:'tunnel'};}
  const abyssSpawns=(()=>{const list=[],plan={hall:['goblin','bat'],lake:['wisp','bat','wisp'],crystal:['golem','golem','bat'],mushroom:['goblin','goblinShaman','spider'],web:['spider','spider'],geode:['golem'],roost:['bat','bat','bat'],magma:['ember','ember']};
    const floor=(x,y)=>{const c=abyssCell(abyss.rx+x,abyss.ry+y);return c&&['cavefloor','mushroom'].includes(c.kind);};
    for(const a of abyssAreas){if(a.lair)list.push({id:'abyss:boss:'+a.id,kind:a.lair,x:abyss.rx+a.x,y:abyss.ry+a.y-.5,area:a.id,boss:true});
      (plan[a.id]||[]).forEach((kind,i)=>{const ang=i*2.4+a.x*.1;let px=a.x,py=a.y;for(const r of [.55,.75,.9,.35,.2]){px=a.x+Math.cos(ang)*a.rx*r;py=a.y+Math.sin(ang)*a.ry*r;if(floor(px,py))break;}list.push({id:'abyss:'+a.id+':'+i,kind,x:abyss.rx+Math.floor(px)+.5,y:abyss.ry+Math.floor(py)+.5,area:a.id});});}
    return list;})();
  function spawnAbyss(w){for(const sp of abyssSpawns){if(w.monsters[sp.id])continue;const t=monsterTypes[sp.kind],hp=t.boss?t.hp:t.hp+abyss.tier*9;w.monsters[sp.id]={id:sp.id,kind:sp.kind,x:sp.x,y:sp.y,homeX:sp.x,homeY:sp.y,hp,maxHp:hp,tier:abyss.tier,attack:0,hurtAt:-5,deep:true,lairArea:sp.boss?sp.area:null};}}
  function abyssInfo(w){const d=w.deep||{};return {slain:abyssGuardians.filter(k=>d.slain?.[k]).length,total:abyssGuardians.length,sealOpen:!!d.sealOpen,wyrmSlain:!!d.slain?.wyrm};}
  // ---------- Cidadela do Totem: raide profunda com quatro alas, totens e o Grande Totem ----------
  const citadel=expeditions.find(d=>d.id==='totem-citadel');
  const citadelAreas=[
    {id:'gate',name:'Átrio dos Ossos',sub:'A entrada. O portal ao sul leva de volta à superfície.',x:9,y:25,rx:6.5,ry:5,theme:'gate'},
    {id:'gallery',name:'Galeria dos Totens Caídos',sub:'Pedaços de totens antigos cobrem o chão.',x:25,y:17,rx:8.5,ry:6,theme:'gallery'},
    {id:'roots',name:'Bosque Petrificado',sub:'Raízes de pedra. O Barão Cardo guarda o totem das raízes.',x:27,y:5,rx:8,ry:3.8,theme:'roots',boss:'rootBoss'},
    {id:'mire',name:'Pântano Sepulto',sub:'Lodo parado. Marta Juncal guarda o totem do lodo.',x:42,y:28,rx:9,ry:4.6,theme:'mire',boss:'tideBoss'},
    {id:'bridge',name:'Ponte das Cinzas',sub:'Um caminho estreito entre rios de magma.',x:53,y:16,rx:9,ry:4.2,theme:'bridge'},
    {id:'ash',name:'Forja das Cinzas',sub:'Brasas no ar. A Condessa Ísis guarda o totem das cinzas.',x:66,y:6,rx:8.5,ry:4.4,theme:'ash',boss:'ashBoss'},
    {id:'frost',name:'Cripta da Geada',sub:'Gelo nas paredes. Hrokk guarda o totem da geada.',x:70,y:27,rx:8.5,ry:5,theme:'frost',boss:'frostBoss'},
    {id:'ante',name:'Portão dos Quatro Selos',sub:'Quatro chefes derrotados abrem o selo.',x:82,y:16,rx:5,ry:4,theme:'ante'},
    {id:'arena',name:'Santuário do Grande Totem',sub:'O coração da cidadela. O Grande Totem desperta.',x:102,y:17,rx:13.5,ry:12,theme:'arena',boss:'greatTotem'}
  ];
  const citadelTunnels=[['gate','gallery',1.8],['gallery','roots',1.6],['gallery','mire',1.6],['gallery','bridge',1.8],['mire','bridge',1.4],['bridge','ash',1.6],['bridge','frost',1.6],['bridge','ante',1.8],['frost','ante',1.4],['ante','arena',1.8]];
  const citadelWings=citadelAreas.filter(a=>a.boss&&a.id!=='arena');
  const citadelGrid=(()=>{
    const W=citadel.w,H=citadel.h,grid=new Array(W*H).fill(null),area=id=>citadelAreas.find(a=>a.id===id);
    const oval=(a,x,y)=>((x+.5-a.x)/a.rx)**2+((y+.5-a.y)/a.ry)**2;
    for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){const a=citadelAreas.find(a=>oval(a,x,y)<1+(hash(x,y,4411)-.5)*.25);if(a)grid[y*W+x]={kind:'cavefloor',area:a.id,theme:a.theme};}
    // Tunnels first carve rock; the second pass (clear) only marks a guaranteed walking lane.
    const carve=(a,b,width,clear)=>{const len=Math.hypot(b.x-a.x,b.y-a.y);for(let t=0;t<=1;t+=.4/len){const cx=a.x+(b.x-a.x)*t,cy=a.y+(b.y-a.y)*t+Math.sin(t*Math.PI*2)*1.2*Math.sin(t*Math.PI);
      for(let y=Math.floor(cy-width-1);y<=cy+width+1;y++)for(let x=Math.floor(cx-width-1);x<=cx+width+1;x++){if(x<1||y<1||x>=W-1||y>=H-1)continue;if(Math.hypot(x+.5-cx,y+.5-cy)<=width){const c=grid[y*W+x];if(!c)grid[y*W+x]={kind:'cavefloor',area:'tunnel',theme:'crypt',tunnel:a.id+'-'+b.id};else if(clear)c.clear=true;}}}};
    for(const [from,to,width] of citadelTunnels)carve(area(from),area(to),width,false);
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){const c=grid[y*W+x];if(!c){grid[y*W+x]={kind:'wall',theme:'wall'};continue;}
      const a=area(c.area),n=hash(x,y,5151),o=a?oval(a,x,y):1;
      if(x>=86&&x<=87){c.kind='seal';continue;}
      if(c.area==='bridge'&&Math.abs(y+.5-a.y)>1.8&&o<.9&&Math.abs(x+.5-a.x)<7){c.kind='lava';continue;}
      if(c.area==='mire'&&o<.75&&o>.12&&n>.62){c.kind='water';continue;}
      if(a&&o>.5&&o<.95&&!a.boss&&n>.94){c.kind='stal';continue;}
      if(c.area==='gallery'&&o>.3&&o<.9&&n>.9){c.kind='rock';c.ore=4+Math.floor(hash(x,y,61)*4);continue;}
      if(c.area==='frost'&&o>.55&&n>.86){c.kind='rock';c.ore=8;continue;}
    }
    for(const [from,to] of citadelTunnels)carve(area(from),area(to),1.3,true);
    for(const c of grid)if(c.clear){if(['stal','rock','water','lava'].includes(c.kind)){c.kind='cavefloor';delete c.ore;}delete c.clear;}
    return grid;
  })();
  function citadelCell(x,y){x=Math.floor(x)-citadel.rx;y=Math.floor(y)-citadel.ry;if(x<0||y<0||x>=citadel.w||y>=citadel.h)return null;return citadelGrid[y*citadel.w+x];}
  function citadelArea(x,y){const c=citadelCell(x,y);if(!c)return null;return citadelAreas.find(a=>a.id===c.area)||{id:'tunnel',name:'Criptas da Cidadela',sub:'Corredores entre as alas.',theme:'crypt'};}
  const citadelSpawns=(()=>{const list=[],plan={gate:['goblin','shade'],gallery:['shade','goblin','necromancer'],roots:['wolf','slime'],mire:['slime','wisp','slime'],bridge:['ember','golem','ember'],ash:['ember','necromancer'],frost:['ice','wolf','ice'],ante:['necromancer','golem']};
    const floor=(x,y)=>{const c=citadelCell(citadel.rx+x,citadel.ry+y);return c&&c.kind==='cavefloor';};
    for(const a of citadelAreas){
      if(a.boss){const bx=a.id==='arena'?a.x+3:a.x+2.5,tx=a.id==='arena'?a.x:a.x-2.5;list.push({id:'citadel:boss:'+a.id,kind:a.boss,x:citadel.rx+bx,y:citadel.ry+a.y,area:a.id,boss:true});
        if(a.id!=='arena')list.push({id:'citadel:totem:'+a.id,kind:'totem',x:citadel.rx+Math.floor(tx)+.5,y:citadel.ry+Math.floor(a.y)-.5,area:a.id,totem:true});}
      (plan[a.id]||[]).forEach((kind,i)=>{const ang=i*2.2+a.x*.13;let px=a.x,py=a.y;for(const r of [.6,.75,.45,.3,.15]){px=a.x+Math.cos(ang)*a.rx*r;py=a.y+Math.sin(ang)*a.ry*r;if(floor(px,py))break;}list.push({id:'citadel:'+a.id+':'+i,kind,x:citadel.rx+Math.floor(px)+.5,y:citadel.ry+Math.floor(py)+.5,area:a.id});});}
    return list;})();
  function spawnCitadel(w){w.citadel||={slain:{},totems:{}};for(const sp of citadelSpawns){if(w.monsters[sp.id])continue;const t=monsterTypes[sp.kind],hp=t.boss?Math.round(t.hp*1.4):t.hp+citadel.tier*9;
    w.monsters[sp.id]={id:sp.id,kind:sp.kind,x:sp.x,y:sp.y,homeX:sp.x,homeY:sp.y,hp,maxHp:hp,tier:citadel.tier,attack:0,hurtAt:-5,citadel:true,area:sp.area};
    if(sp.boss&&sp.area!=='arena')w.monsters[sp.id].shield='citadel:totem:'+sp.area;
    if(sp.boss&&w.citadel.slain?.[sp.kind]||sp.totem&&w.citadel.totems?.[sp.area]){w.monsters[sp.id].hp=0;w.monsters[sp.id].respawn=1e12;}}}
  function citadelInfo(w){const c=w.citadel||{};return {totems:citadelWings.filter(a=>c.totems?.[a.id]).length,bosses:citadelWings.filter(a=>c.slain?.[a.boss]).length,total:citadelWings.length,open:!!c.open,cleared:!!c.clearedAt};}
  function citadelTeam(w,m,p){const team=Object.values(w.players).filter(q=>!q.dead&&dungeonAt(q.x,q.y)===citadel&&Math.hypot(q.x-m.x,q.y-m.y)<30);if(p&&!team.includes(p))team.push(p);return team;}
  function citadelDown(w,p,m){w.citadel||={slain:{},totems:{}};const c=w.citadel;c.slain||={};c.totems||={};const team=citadelTeam(w,m,p);
    if(m.kind==='totem'){c.totems[m.area]=true;for(const id of Object.keys(w.monsters))if(w.monsters[id].totemMinion===m.id)delete w.monsters[id];for(const q of team)notify(w,q,'Totem destruído! O escudo de '+monsterTypes[citadelAreas.find(a=>a.id===m.area).boss].name+' caiu.');return;}
    if(!isBoss(m))return;const t=monsterTypes[m.kind];c.slain[m.kind]=true;
    for(const q of team){if(t.trophy&&!q.trophies?.includes(t.trophy)){(q.trophies||=[]).push(t.trophy);give(q,t.trophy);notify(w,q,'Troféu: '+items[t.trophy].name);}q.raidsCleared||={};q.raidsCleared[m.kind]=(q.raidsCleared[m.kind]||0)+1;}
    if(m.kind==='greatTotem'){c.clearedAt=w.time;for(const id of Object.keys(w.monsters))if(w.monsters[id].totemMinion)delete w.monsters[id];for(const q of team){const noble=familyOf(q).noble,ore=noble?6:8;q.gold+=500;give(q,'ore14',ore);give(q,'essence',8);give(q,'potion',5);gainXP(w,q,450);if(q.guild)q.guild.reputation+=60+(noble?10:0);q.raidsCompleted=(q.raidsCompleted||0)+1;notify(w,q,`O Grande Totem caiu! +500 moedas · +${ore} âmbar antigo · +5 poções. A cidadela desperta de novo em 5 minutos.`);}return;}
    if(!c.open&&citadelWings.every(a=>c.slain[a.boss])){c.open=true;for(const q of Object.values(w.players))if(dungeonAt(q.x,q.y)===citadel)notify(w,q,'Os quatro chefes caíram. O Portão dos Quatro Selos se abriu!');}}
  function updateCitadel(w){const c=w.citadel;if(!c)return;const inside=Object.values(w.players).filter(q=>!q.dead&&q.online!==false&&dungeonAt(q.x,q.y)===citadel);
    if(c.clearedAt&&w.time>c.clearedAt+300&&!inside.length){for(const id of Object.keys(w.monsters))if(w.monsters[id].citadel)delete w.monsters[id];w.citadel={slain:{},totems:{}};return;}
    if(!inside.length)return;
    for(const m of Object.values(w.monsters)){if(!m.citadel||m.hp<=0||!['totem','greatTotem'].includes(m.kind))continue;if(!inside.some(q=>Math.hypot(q.x-m.x,q.y-m.y)<11))continue;
      if((m.pulseAt||0)>w.time)continue;m.pulseAt=w.time+(m.kind==='totem'?9:7);const alive=Object.values(w.monsters).filter(o=>o.totemMinion===m.id&&o.hp>0).length;if(alive>=(m.kind==='totem'?2:4))continue;
      event(w,'warning',m.x,m.y,'✦',monsterTypes[m.kind].color);const t=monsterTypes.shade;for(let i=0;i<(m.kind==='totem'?1:2);i++){const a=w.time*1.7+i*3,x=m.x+Math.cos(a)*2.2,y=m.y+Math.sin(a)*1.6+1;if(!walkable(w,x,y))continue;const id=m.id+':sombra:'+Math.floor(w.time*10)+i,hp=t.hp+citadel.tier*6;w.monsters[id]={id,kind:'shade',x,y,homeX:x,homeY:y,hp,maxHp:hp,tier:citadel.tier,attack:0,hurtAt:-5,citadel:true,minion:true,totemMinion:m.id};}}}
  for(const d of expeditions){if(d.kind==='deep'||d.kind==='citadel')continue;landmarks.push({id:d.id,name:d.name,x:d.x,y:d.y,kind:d.kind});landmarks.push({id:d.id+'-exit',name:'Saída · '+d.name,x:d.rx+d.w/2,y:d.ry+d.h-3,kind:'exit',expedition:d.id});}
  landmarks.push({id:'guild',name:'Guilda dos Caminhantes',kind:'guild',x:125,y:128});
  landmarks.push({id:'abyss-exit',name:'Saída · Abismo de Véspera',x:abyss.rx+abyss.w/2,y:abyss.ry+abyss.h-3,kind:'exit',expedition:'abyss'});
  landmarks.push({id:'abyss',name:'Abismo de Véspera',x:abyss.x,y:abyss.y,kind:'deep'});
  landmarks.push({id:'totem-citadel',name:'Cidadela do Totem',x:citadel.x,y:citadel.y,kind:'citadel'});
  landmarks.push({id:'totem-citadel-exit',name:'Saída · Cidadela do Totem',x:citadel.rx+9,y:citadel.ry+29,kind:'exit',expedition:'totem-citadel'});
  for(const a of abyssAreas)if(a.lair)landmarks.push({id:'hoard-'+a.id,name:'Tesouro · '+a.name,kind:'hoard',x:abyss.rx+Math.floor(a.x),y:abyss.ry+Math.floor(a.y-a.ry*.55),area:a.id,lair:a.lair});
  for(const h of playableHouses)landmarks.push({id:'seat-'+h.id,name:h.seat.name,x:h.seat.x,y:h.seat.y,kind:'seat',house:h.id,noble:h.noble});
  // Covil dos Goblins: its mouth opens just north of the east road, 44 tiles past the valley's edge.
  const lairExp=Lair?{id:'goblin-lair',name:'Covil dos Goblins',kind:'lair',x:300,y:118,rx:3000,ry:0,w:Lair.W,h:Lair.H,tier:5}:null;
  if(lairExp){expeditions.push(lairExp);landmarks.push({id:'goblin-lair',name:'Covil dos Goblins',x:lairExp.x,y:lairExp.y,kind:'lair'});
    landmarks.push({id:'goblin-lair-exit',name:'Saída · Covil dos Goblins',x:lairExp.rx+Math.floor(Lair.entry.x),y:lairExp.ry+Math.floor(Lair.entry.y),kind:'exit',expedition:'goblin-lair'});
    landmarks.push({id:'hoard-goblin',name:'Tesouro de Gorzak',kind:'hoard',x:lairExp.rx+Lair.hoard.x,y:lairExp.ry+Lair.hoard.y,area:'throne',lair:'goblinKing',goblin:true});}
  // Goblin camps in the frontier: a marker each (the chest is the loot point).
  if(Frontier)for(const c of Frontier.camps)landmarks.push({id:c.id,name:'Acampamento goblin',x:c.x+3,y:c.y+2,kind:'camp',camp:c.id,frontier:true});
  function lairCell(x,y){return lairExp?Lair.cell(x-lairExp.rx,y-lairExp.ry):null;}
  function lairArea(x,y){const c=lairCell(x,y);if(!c)return null;return Lair.areas.find(a=>a.id===c.area)||{id:'tunnel',name:'Túneis do Covil',sub:'Passagens baixas cheirando a fumaça.',theme:'tunnel'};}
  function lairInfo(w){const l=w.lair||{};return {slain:Lair?Lair.guardians.filter(k=>l.slain?.[k]).length:0,total:Lair?Lair.guardians.length:0,open:!!l.open,kingSlain:!!l.slain?.goblinKing};}
  function spawnLair(w){if(!lairExp)return;for(const sp of Lair.spawns){const id='lair:'+sp.key;if(w.monsters[id])continue;const t=monsterTypes[sp.kind],hp=t.boss?t.hp:t.hp+lairExp.tier*9,x=lairExp.rx+sp.x,y=lairExp.ry+sp.y;w.monsters[id]={id,kind:sp.kind,x,y,homeX:x,homeY:y,hp,maxHp:hp,tier:lairExp.tier,attack:0,hurtAt:-5,lair:true,lairArea:sp.boss?sp.area:null};}}
  function lairBoss(w,p,m){const t=monsterTypes[m.kind];w.lair||={slain:{}};w.lair.slain||={};const first=!w.lair.slain[m.kind];w.lair.slain[m.kind]=true;
    const team=Object.values(w.players).filter(q=>!q.dead&&dungeonAt(q.x,q.y)===lairExp&&Math.hypot(q.x-m.x,q.y-m.y)<24);if(!team.includes(p))team.push(p);
    if(m.kind==='goblinKing'){for(const q of team){if(!q.trophies?.includes(t.trophy)){(q.trophies||=[]).push(t.trophy);give(q,t.trophy);notify(w,q,'Troféu: '+items[t.trophy].name);}q.gold+=200;gainXP(w,q,220);notify(w,q,'Gorzak caiu! O Covil dos Goblins está em pânico. +200 moedas');}return;}
    for(const q of team){q.gold+=80;gainXP(w,q,90);}
    if(!w.lair.open&&Lair.guardians.every(k=>w.lair.slain[k])){w.lair.open=true;for(const q of Object.values(w.players))if(dungeonAt(q.x,q.y)===lairExp)notify(w,q,'Murk e Grol caíram. O portão de guerra do Rei Goblin se abriu!');}
    else if(first&&!w.lair.open)for(const q of team)notify(w,q,'Campeões derrotados: '+Lair.guardians.filter(k=>w.lair.slain[k]).length+'/2. O portão do rei range.');}
  function dungeonAt(x,y){return expeditions.find(d=>x>=d.rx&&x<d.rx+d.w&&y>=d.ry&&y<d.ry+d.h);}
  function monsterDensity(b){return b<=1?1:2;}
  // Each biome rolls from its own table; slimes live everywhere.
  const biomeMobs=[['slime','slime','slime','mushroom'],['wolf','slime','sylph','mushroom','wolf'],['wisp','slime','lizardman','wisp','naga'],['scarab','slime','antSoldier','scarab','duneWraith'],
    ['ice','slime','iceElf','gargoyle','ice','glacierHound'],['necromancer','skeleton','wraith','sylph','slime'],['ember','hellhound','harpy','slime','ember'],['wolf','orc','harpy','slime','dragonkin']];
  const mobFor=(b,x,y,i,seed)=>{const list=biomeMobs[b]||['slime'];return list[Math.floor(hash(x*3+i,y*5+i,seed+77)*list.length)];};
  function guildInfo(p){const g=p.guild;return !g?'Junte-se aos Caminhantes e aceite contratos de mineração e caça.':`Reputação: ${g.reputation} · Contrato ${g.contract+1}: ${g.contract%2?'derrote 5 monstros':'extraia 8 veios na caverna'} (${Math.min(g.contract%2?p.kills-g.startKills:(p.mined||0)-g.startMined,g.contract%2?5:8)}/${g.contract%2?5:8}). Recompensa: 60 moedas, 2 poções e 20 reputação.`;}
  function guildDialog(p){p.dialog={kind:'guild',title:'Guilda dos Caminhantes',text:guildInfo(p)};}
  function wave(w,d,state){
    const kinds=state.wave===3?[d.boss||'boss']:(d.waves?.[state.wave-1])||(state.wave===2?['ice','necromancer','wolf']:['slime','scarab','wisp']);
    state.ids=kinds.map((kind,i)=>{const id=d.id+':'+state.wave+':'+i,t=monsterTypes[kind],x=kinds.length===1?d.rx+d.w/2:d.rx+9+i*3,y=d.ry+8;
      const hp=Math.round((t.boss?(260+d.tier*40)*(t.hpMul||1):t.hp+d.tier*9)*state.scale);
      w.monsters[id]={id,kind,x,y,homeX:x,homeY:y,hp,maxHp:hp,tier:d.tier,attack:0,hurtAt:-5,raid:d.id};return id;});
  }
  function updateRaids(w){for(const d of expeditions.filter(d=>d.kind==='raid')){const r=w.raids?.[d.id];if(!r?.active)continue;
    const team=r.members.map(id=>w.players[id]).filter(p=>p&&!p.dead&&p.online!==false&&dungeonAt(p.x,p.y)===d);
    if(!team.length){r.active=false;r.readyAt=w.time+10;for(const id of r.ids)delete w.monsters[id];continue;}
    if(r.ids.some(id=>w.monsters[id]?.hp>0))continue;
    for(const id of r.ids)delete w.monsters[id];
    if(r.wave<3){r.wave++;wave(w,d,r);for(const p of team)notify(w,p,`${d.name} · onda ${r.wave}/3`);}
    else{r.active=false;r.readyAt=w.time+180;for(const p of team){const noble=familyOf(p).noble,ore=noble?6:8;p.gold+=180;give(p,'ore'+Math.min(15,d.tier*2+1),ore);give(p,'potion',3);gainXP(w,p,180);if(p.guild)p.guild.reputation+=30+(noble?10:0);p.raidsCompleted=(p.raidsCompleted||0)+1;p.raidsCleared||={};p.raidsCleared[d.id]=(p.raidsCleared[d.id]||0)+1;const boss=monsterTypes[d.boss];let trophy='';if(boss?.trophy&&!p.trophies?.includes(boss.trophy)){(p.trophies||=[]).push(boss.trophy);give(p,boss.trophy);trophy=' · Troféu: '+items[boss.trophy].name;}notify(w,p,`Raide concluída! +180 moedas · +${ore} minérios · +3 poções${trophy}`);}}
  }}

  const buildings=[{x:112,y:119,w:6,h:4,kind:'guild',name:'GUILDA DOS CAMINHANTES'},{x:120,y:123,w:4,h:3,kind:'forge',name:'FORJA'},{x:131,y:119,w:5,h:4,kind:'inn',name:'POUSADA'},{x:119,y:134,w:4,h:3,kind:'house',name:''},{x:135,y:135,w:4,h:3,kind:'house',name:''}];
  const kingdoms=[
    {id:'auroria',name:'Reino de Aurória',x:128,y:81,bounds:{x0:106,x1:150,y0:47,y1:113},color:'#c69b48',roof:'#436e78',sigil:'☀',motto:'A luz pertence a quem a compartilha.',lore:'A maior cidade do vale. Muralhas brancas cercam a praça do chafariz, o mercado, a capela, o palácio de marfim e o Distrito Alto, com moinho, lago real, quartel e torre do relógio. Aurória mantém as estradas abertas e acolhe viajantes de todas as famílias.',court:[
      {title:'Rei',name:'Aldren Solalto',text:'Uma coroa só tem valor quando seu povo pode dormir em paz. As estradas até Salgueiro estão sob nossa proteção.'},
      {title:'Rainha',name:'Isadora Solalto',text:'Os arquivos registram cada família do vale. Nobreza sem cuidado é apenas um nome bordado em seda.'},
      {title:'Princesa',name:'Elena Solalto',text:'Quero desenhar um mapa que não termine nas muralhas. Íria, em Salgueiro, pode ajudar você a começar.'},
      {title:'Príncipe',name:'Cael Solalto',text:'Treino com os guardas ao amanhecer. Antes de enfrentar um chefe, prepare equipamento e aprenda a esquivar.'}]},
    {id:'lunaria',name:'Reino de Lunária',x:190,y:124,color:'#b8a2de',roof:'#64528c',sigil:'☾',motto:'Mesmo na noite, há caminhos.',lore:'Entre bosques e rios, Lunária ergue torres violetas. Sua corte protege a memória dos santuários e o estudo das estrelas.',court:[
      {title:'Rei',name:'Orion Véulunar',text:'O silêncio dos bosques não é vazio. Escute antes de atravessar as ruínas.'},
      {title:'Rainha',name:'Selene Véulunar',text:'Os santuários conservam memórias que as coroas preferem esquecer. Visite o Altar de Âmbar para ouvir uma delas.'},
      {title:'Princesa',name:'Lyra Véulunar',text:'Estudo os cristais subterrâneos. As minas mais profundas escondem materiais para equipamentos raros.'},
      {title:'Príncipe',name:'Noan Véulunar',text:'As lanternas marcam nosso pátio. Aqui você pode descansar; além dele, mantenha a guarda.'}]},
    {id:'brasalar',name:'Reino de Brasalar',x:111,y:190,color:'#e39865',roof:'#973f45',sigil:'✧',motto:'Da brasa nasce o amanhã.',lore:'Pedra rosada e estandartes rubros anunciam Brasalar. Ferreiros e viajantes encontram abrigo nos jardins de sua fortaleza.',court:[
      {title:'Rei',name:'Darian Rubrálio',text:'Nossas muralhas foram erguidas por artesãos. Respeite quem constrói tanto quanto quem empunha a espada.'},
      {title:'Rainha',name:'Amara Rubrálio',text:'A pousada e este palácio recebem os exaustos. Descanse antes de retomar a estrada.'},
      {title:'Princesa',name:'Mira Rubrálio',text:'Cada minério pede um trabalho diferente. Compare os atributos antes de gastar seus materiais.'},
      {title:'Príncipe',name:'Ravi Rubrálio',text:'Exploro o sul em busca de histórias. O Observatório Soterrado é um bom destino para quem já se preparou.'}]}
  ];
  const merchantGoods=[{id:'potion',price:18},{id:'herb',price:4},{id:'wood',price:3},{id:'ore0',price:8}];
  for(const [i,k] of kingdoms.entries()){if(k.bounds)continue;
    for(const [j,role] of ['padeira','jardineiro','guarda','aprendiz'].entries())npcDefs.push({id:k.id+'-citizen-'+j,name:[['Cora','Bram','Leon','Yuna'],['Ayla','Nilo','Soren','Lumi'],['Zara','Omar','Ruan','Hana']][i][j]+', '+role,classId:['clerigo','druida','paladino','mago'][j],appearance:j%2?'male':'female',role:'talk',citizen:true,path:[[k.x-5+j*3,k.y+3],[k.x-5+j*3,k.y+5]],speed:.22+j*.04,text:['O forno acorda antes do sol. Toda caravana leva um pouco do nosso pão.','Cuido destes jardins desde antes da coroação. As flores não se importam com títulos.','As estradas ligam nossas coroas. O pátio do palácio oferece abrigo aos viajantes.','Vim de longe para estudar magia. Talvez você também esteja procurando seu lugar neste mundo.'][j]});
  }
  const capitalGoods={
    greens:[{id:'herb',price:4},{id:'berry',price:3},{id:'wheat',price:3},{id:'bread',price:9}],
    apothecary:[{id:'potion',price:18},{id:'mana',price:16},{id:'antidote',price:12},{id:'elixir',price:40}],
    ores:[{id:'ore0',price:8},{id:'ore1',price:10},{id:'ore2',price:14},{id:'coal',price:6}],
    fish:[{id:'fish',price:6},{id:'soup',price:14},{id:'bread',price:9}],
    crafts:[{id:'lantern',price:30},{id:'bench',price:26},{id:'fence',price:12},{id:'campfire',price:20}],
    arms:[{id:'tonic',price:22},{id:'bomb',price:25},{id:'leather',price:10},{id:'fiber',price:5}]};
  const town=(id,name,text,path,extra={})=>npcDefs.push({id:'auroria-'+id,name,classId:extra.classId||'bardo',appearance:extra.body==='man'||extra.body==='boy'?'male':'female',role:extra.goods?'merchant':'talk',citizen:true,capital:true,path,speed:extra.speed??.4,text,...extra});
  town('guarda-bruno','Bruno, guarda do portão','Ninguém entra armado de má intenção. Os outros, bem-vindos a Aurória!',[[126.5,112.4],[130.5,112.4]],{look:{body:'man',outfit:'armor',hat:'helmet',item:'spear'},speed:.35});
  town('guarda-ines','Inês, guarda da muralha','Da muralha se vê a Cidadela do Totem ao sul. À noite, as luzes de lá piscam sozinhas.',[[113.5,112.5],[123.5,112.5]],{body:'woman',look:{body:'woman',outfit:'armor',hat:'helmet',item:'spear'},speed:.3});
  town('cavaleiro-rolf','Sir Rolf, cavaleiro','Juro proteger a princesa Elena. Ela prefere que eu proteja as flores do jardim.',[[114.5,84.5],[143.5,84.5]],{look:{body:'man',outfit:'armor',hat:'feather',item:'sword',cape:true},speed:.5});
  town('dama-celia','Dama Célia de Luar','Vim da Casa Luar para o baile de primavera. Aurória tem as melhores sedas do vale.',[[143.5,84.5],[114.5,84.5]],{body:'woman',look:{body:'woman',outfit:'gown',hat:'feather',item:'flowers'},speed:.28});
  town('padeira-rosa','Rosa, padeira','O pão sai quente às seis. Se chegar às sete, só sobra o cheiro.',[[119.5,86.5],[119.5,96.5]],{body:'woman',look:{body:'woman',outfit:'apron',hat:'chef',item:'basket'},speed:.38});
  town('florista-lia','Lia, florista','Cada casa tem uma cor de flor. A minha é a das amarelas, perto do chafariz.',[[125.5,89.5],[131.5,89.5],[131.5,93.5],[125.5,93.5]],{body:'woman',look:{body:'woman',outfit:'dress',hat:'straw',item:'flowers'},speed:.33});
  town('menino-tito','Tito, menino da praça','Aposto que consigo dar dez voltas no chafariz antes de você!',[[124.5,88.5],[132.5,88.5],[132.5,94.5],[124.5,94.5]],{body:'boy',look:{body:'child',hair:'spiky'},speed:1.1});
  town('menina-bia','Bia, menina da praça','O Tito sempre perde. Eu corro de trás pra frente!',[[132.5,94.5],[124.5,94.5],[124.5,88.5],[132.5,88.5]],{body:'woman',look:{body:'child',hair:'ponytail'},speed:1.05});
  town('bardo-ciro','Ciro, bardo','Toco a Balada das Três Coroas. Três moedas e eu toco de novo; cinco e eu paro.',[[133.2,95.3]],{look:{body:'man',outfit:'coat',hat:'feather',item:'lute'},face:0,bard:true});
  town('sacerdotisa-alma','Irmã Alma, da capela','A capela acende uma vela por cada viajante que não voltou. Volte, por favor.',[[137.5,88.5],[137.5,96.5]],{body:'woman',look:{body:'woman',outfit:'robe',hat:'hood',item:'book'},speed:.25});
  town('estudioso-otto','Otto, estudioso','Os totens da cidadela são mais antigos que as coroas. Quatro alas, quatro famílias caídas.',[[114.5,98.5],[143.5,98.5]],{look:{body:'elder',outfit:'robe',hat:'wizard',item:'staff'},speed:.22});
  town('criada-nina','Nina, criada do palácio','O rei acorda cedo; a rainha, antes dele. A princesa, só depois do jardim.',[[120.5,81.5],[136.5,81.5]],{body:'woman',look:{body:'woman',outfit:'apron',hat:'bandana',item:'broom'},speed:.45});
  town('pregoeiro-davi','Davi, pregoeiro','Ouçam, ouçam! A Cidadela do Totem voltou a pulsar! Recompensas para quem quebrar os quatro totens!',[[128.5,100.5],[128.5,110.5]],{look:{body:'man',outfit:'noble',hat:'cap',item:'bell'},speed:.3});
  town('ferreiro-gus','Gus, aprendiz de ferreiro','Mestre Bento me mandou buscar carvão. Faz três dias.',[[137.5,100.5],[137.5,111.5]],{look:{body:'man',outfit:'apron',hat:'bandana',item:'bag'},speed:.55});
  town('casal-ana','Ana, tecelã','Meu marido diz que o mercado é caro. Ele nunca comprou tecido na Lunária.',[[119.5,100.5],[119.5,111.5]],{body:'woman',look:{body:'woman',outfit:'dress',hat:'bandana',item:'basket'},speed:.3});
  town('velho-joao','Seu João','Sessenta anos neste banco. Vi três reis, duas guerras e um dragão. O dragão era o melhor.',[[133.5,102.4]],{look:{body:'elder',outfit:'coat',hat:'cap',item:'staff'},face:0});
  town('princesa-elena','Princesa Elena Solalto','Quero desenhar um mapa que não termine nas muralhas. Me conte: o que há além da Cidadela?',[[114.5,76.5],[119.5,76.5],[119.5,77.5],[114.5,77.5]],{body:'woman',royal:true,look:{body:'woman',outfit:'gown',hat:'tiara',hair:'long',main:'#e28fb0',accent:'#f6e3a8',cape:true},speed:.3});
  town('dama-companhia','Lívia, dama de companhia','A princesa conversa com as roseiras. As roseiras, às vezes, respondem.',[[115.5,77.5],[119.5,77.5],[119.5,76.5],[115.5,76.5]],{body:'woman',look:{body:'woman',outfit:'dress',hat:'none',hair:'bun',item:'book'},speed:.3});
  town('principe-cael','Príncipe Cael Solalto','Antes de enfrentar um chefe, prepare equipamento e aprenda a esquivar. De novo! Guarda alta!',[[134.5,82.4]],{royal:true,look:{body:'man',outfit:'noble',hat:'crown',item:'sword',cape:true,main:'#3f6f8f'},face:1});
  town('mestre-armas','Mestre Varg, instrutor','O príncipe melhora. Mas ainda fecha os olhos quando eu ataco.',[[132.6,82.4]],{look:{body:'elder',outfit:'armor',hat:'none',beard:'full',item:'sword'},face:2});
  town('verdureira-lucia','Dona Lúcia, verdureira','Ervas, amoras e pão da Rosa. Tudo fresco de hoje!',[[121.0,100.6]],{body:'woman',look:{body:'woman',outfit:'apron',hat:'straw'},face:0,goods:capitalGoods.greens});
  town('boticario-tome','Tomé, boticário','Poções de vida, tônicos e antídotos. A receita é segredo de família.',[[124.0,100.6]],{look:{body:'elder',outfit:'robe',hat:'wizard'},face:0,goods:capitalGoods.apothecary});
  town('mineira-ilda','Ilda, mercadora de minérios','Cobre, estanho, ferro e carvão. Para mithril, vá cavar você mesmo.',[[121.0,104.6]],{body:'woman',look:{body:'woman',outfit:'coat',hat:'bandana'},face:0,goods:capitalGoods.ores});
  town('pescador-fabio','Fábio, peixeiro','Peixe do rio, sopa quente e pão. O melhor almoço de Aurória.',[[124.0,104.6]],{look:{body:'man',outfit:'tunic',hat:'straw',beard:'full'},face:0,goods:capitalGoods.fish});
  town('artesao-caio','Caio, artesão','Lanternas, bancos e cercas para sua casa. Entrega não incluída.',[[121.0,108.6]],{look:{body:'man',outfit:'apron',hat:'cap',beard:'mustache'},face:0,goods:capitalGoods.crafts});
  town('armeira-vera','Vera, armeira','Bombas, tônicos e couro curtido. Para quem vai à Cidadela.',[[124.0,108.6]],{body:'woman',look:{body:'woman',outfit:'armor',hat:'none',hair:'braids'},face:0,goods:capitalGoods.arms});
  town('guarda-teo','Téo, guarda do portão norte','O portão norte leva à taiga. Lenhadores passam cedo; lobos, à noite.',[[126.5,48.4],[130.5,48.4]],{look:{body:'man',outfit:'armor',hat:'helmet',item:'spear',beard:'mustache'},speed:.33});
  town('guarda-ronda','Marta, sentinela da ronda','Faço a ronda do bulevar até o quartel. Se ouvir o sino três vezes, corra para a capela.',[[113.5,68.5],[143.5,68.5]],{body:'woman',look:{body:'woman',outfit:'armor',hat:'helmet',item:'spear',hair:'ponytail'},speed:.42});
  town('moleiro-bento','Bento, moleiro','O vento do norte gira o moinho dia e noite. Farinha de Aurória vai até Brasalar.',[[119.5,50.5],[119.5,56.5]],{look:{body:'man',outfit:'apron',hat:'straw',beard:'full'},speed:.25});
  town('lavradora-iara','Iara, lavradora','Trigo dourado, pão da Rosa. Tudo começa aqui, no Distrito Alto.',[[113.5,57.4],[118.5,57.4]],{body:'woman',look:{body:'woman',outfit:'dress',hat:'straw',item:'basket'},speed:.3});
  town('sargento-hugo','Sargento Hugo','Um, dois! Escudo alto! Recrutas, o boneco não revida, mas eu revido!',[[141.0,56.4]],{look:{body:'man',outfit:'armor',hat:'feather',item:'sword',beard:'goatee'},face:3});
  town('recruta-duda','Duda, recruta','Três semanas de treino e já acertei o boneco duas vezes. Hoje.',[[138.5,55.6]],{body:'woman',look:{body:'woman',outfit:'armor',hat:'none',item:'sword',hair:'short'},face:3,drill:true});
  town('recruta-caua','Cauã, recruta','Meu pai era pescador. Eu quero ser cavaleiro. Ele ainda não sabe.',[[142.5,55.6]],{look:{body:'boy',outfit:'tunic',hat:'none',item:'sword'},face:3,drill:true});
  town('vovo-cida','Vó Cida','Os patos do lago real me conhecem pelo nome. Eu também não sei o deles.',[[119.5,62.5]],{body:'woman',look:{body:'elder',outfit:'coat',hat:'hood',item:'bag'},face:1});
  town('relojoeiro-abel','Abel, relojoeiro','A torre marca as horas do dia do vale. Quando os ponteiros se juntam, a noite chega.',[[137.5,60.5],[137.5,66.5]],{look:{body:'elder',outfit:'robe',hat:'cap',item:'book'},speed:.2});
  town('menino-leo','Léo, filho do moleiro','Se o moinho parar, o vento está dormindo. Aí eu empurro!',[[120.5,58.4],[135.5,58.4]],{body:'boy',look:{body:'child',hair:'curly'},speed:.95});
  npcDefs.push({id:'merchant-amber',name:'Milo, mercador das estradas',classId:'bardo',appearance:'male',role:'merchant',citizen:true,wagon:true,path:[[128.5,116.5],[128.5,108.5],[128.5,116.5],[128.5,128.5],[157.5,128.5],[190.5,128.5],[157.5,128.5],[128.5,128.5]],speed:.65,text:'De Aurória a Lunária, levo remédios, materiais e notícias. Preços honestos, sem destino obrigatório.'});
  npcDefs.push({id:'merchant-rose',name:'Safi, mercadora de Brasalar',classId:'artifice',appearance:'female',role:'merchant',citizen:true,wagon:true,path:[[128.5,145.5],[128.5,142.5],[118.5,142.5],[118.5,190.5],[118.5,142.5],[128.5,142.5]],speed:.48,text:'Minha carroça traz suprimentos do sul. Guarde algumas moedas para a próxima estrada.'});
  const lookPalette={skin:['#f6d2b3','#eab893','#d19a6f','#b07650','#8a5634','#5f3a24'],
    hairColor:['#2a1f1a','#4a2f22','#6e4326','#9a5b2e','#c8843e','#e0b25c','#f1dc9a','#b8b2a8','#e9e6df','#a8342c','#7a2f5a','#3c4f7a'],
    main:['#3f6f8f','#7a3b3b','#4f7a45','#8a6a2f','#5c4a86','#2f5f5a','#9a4e6e','#b07a3a','#48526e','#6b3f2a','#c2a15a','#3a7a6e','#8f3f5f','#5a6b2f'],
    accent:['#e8d8b0','#c9a45c','#f1efe6','#b8c7d9','#d9a0a0','#9ad0b0','#e0c070'],
    hair:['short','long','bun','ponytail','braids','curly','bald','spiky'],hat:['none','none','none','straw','cap','hood','bandana','feather'],
    outfit:['tunic','dress','robe','apron','coat','noble'],item:['none','none','basket','bag','book','staff','flowers']};
  function stringHash(text){let h=2166136261;for(const c of String(text))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
  function lookSignature(l){return [l.body,l.skin,l.hair,l.hairColor,l.beard,l.outfit,l.main,l.accent,l.hat,l.item].join('|');}
  function rollLook(id,over,salt){const h=stringHash(id+'#'+salt),pick=(list,k)=>list[Math.floor(hash(h%9973,k,h>>>13)*list.length)];
    const body=over.body||pick(['man','woman','woman','man','elder','child'],1),female=body==='woman'||over.female;
    const l={body,skin:pick(lookPalette.skin,2),hair:pick(body==='elder'?['short','bald','bun','long']:female?['long','bun','ponytail','braids','curly','short']:['short','curly','bald','spiky','ponytail','long'],3),
      hairColor:body==='elder'?pick(['#b8b2a8','#e9e6df','#8e8a84'],4):pick(lookPalette.hairColor,4),beard:body==='man'||body==='elder'?pick(['none','none','full','mustache','goatee'],5):'none',
      outfit:pick(female?['dress','dress','apron','robe','coat','tunic','gown']:['tunic','coat','apron','robe','noble','tunic'],6),main:pick(lookPalette.main,7),accent:pick(lookPalette.accent,8),
      hat:pick(lookPalette.hat,9),item:pick(lookPalette.item,10),cape:false};
    return Object.assign(l,over);}
  function assignLooks(){const seen=new Set(),people=[...npcDefs,...kingdoms.flatMap(k=>k.court.map((c,i)=>Object.assign(c,{id:k.id+'-court-'+i,look:c.look||{body:['man','woman','woman','man'][i],outfit:i===1?'gown':i===2?'gown':'noble',hat:i===0||i===1?'crown':i===2?'tiara':'crown',cape:true,main:k.roof,accent:'#f3dc92',item:'none',...(i===0?{beard:'full'}:{})}})))];
    for(const n of people){const defaults={body:n.id==='elder'?'elder':n.appearance==='female'?'woman':'man',hat:'none',item:'none',outfit:'tunic'};if(/guarda|patrulh|instrutor/i.test(n.name))Object.assign(defaults,{outfit:'armor',hat:'helmet',item:'spear'});else if(/padeir|cozinheir|peixeir/i.test(n.name))Object.assign(defaults,{outfit:'apron',hat:'chef',item:'basket'});else if(/jardin|florista|verdureir/i.test(n.name))Object.assign(defaults,{outfit:'tunic',hat:'straw',item:'flowers'});else if(/cartógraf|aprendiz|botic|estudioso/i.test(n.name))Object.assign(defaults,{outfit:'robe',item:'book'});else if(/ferreir|mineir|armeir|artes|prospector/i.test(n.name))Object.assign(defaults,{outfit:'apron',hat:'cap'});const over={...defaults,...n.look};if(n.title)n.royal=true;let l,salt=0;do l=rollLook(n.id,over,salt++);while(seen.has(lookSignature(l))&&salt<40);seen.add(lookSignature(l));n.look=l;}}
  function merchantDialog(w,p,n){p.dialog={kind:'merchant',merchant:n.id,title:n.name,text:n.text,gold:p.gold,goods:(n.goods||merchantGoods).map(o=>({...o,price:Progress.price(w,o)}))};}
  // ---------- Capital de Aurória: muralha, ruas de pedra, praça, mercado e bairros ----------
  const capitalPlaza={x:128.5,y:91.5,r:5.6};
  function capitalStreet(x,y){return x>=126&&x<=130&&(y>=80||y<=69)||y>=80&&y<=83&&x>=119&&x<=137||y===84||y===98||y===99||y===58||y===68||y===69||(x===119||x===137)&&(y>=84||y<=79)||Math.hypot(x+.5-capitalPlaza.x,y+.5-capitalPlaza.y)<capitalPlaza.r;}
  function capitalLayout(k){
    const list=[],add=(kind,x,y,w,h,extra={})=>list.push({kingdom:k.id,kind,x,y,w,h,...extra});
    add('fountain',117,74,2,2);add('fountain',138,74,2,2);
    for(const x of [114,118,138,142])add('ctree',x,71,1,1);
    for(let x=113;x<=118;x++)add('hedge',x,79,1,1);for(let x=138;x<=143;x++)add('hedge',x,79,1,1);
    add('grandFountain',127,90,3,2);
    add('chapel',138,86,6,2);add('tavern',113,100,6,2);
    add('tower',124,111,2,2);add('tower',131,111,2,2);
    for(const y of [101,105,109])for(const [i,x] of [120,123].entries())add('stall',x,y,2,1,{variant:(y-101)/2+i});
    // Distrito Alto (north of the palace): windmill and wheat, royal pond, barracks with dummies, clock tower.
    add('windmill',114,49,4,4);add('wheat',113,54,6,3);
    add('pond',113,60,6,5);
    add('barracks',138,49,6,3);for(const x of [138,140,142])add('dummy',x,54,1,1);
    add('clocktower',139,61,3,3);
    for(const x of [113,114,117,118])add('hedge',x,66,1,1);for(const x of [138,139,142,143])add('hedge',x,66,1,1);
    let style=0;for(const x of [108,145])for(const y of [76,84,92,100,108])add('house',x,y,3,2,{variant:style++});
    for(const bx of [120,131])for(const y of [49,53,60,64])for(const hx of [bx,bx+3])add('house',hx,y,3,2,{variant:style++});
    for(const bx of [113,120,131,138])for(const y of [86,90,94,100,104,108])for(const hx of [bx,bx+3]){
      if(Math.hypot(hx+1.5-capitalPlaza.x,y+1-capitalPlaza.y)<7.5||bx===120&&y>=100||bx===138&&y===86||bx===113&&y===100)continue;
      add('house',hx,y,3,2,{variant:style++});
    }
    const taken=new Set(list.flatMap(d=>{const t=[];for(let yy=d.y-1;yy<=d.y+d.h;yy++)for(let xx=d.x-1;xx<=d.x+d.w;xx++)t.push(xx+','+yy);return t;}));
    for(const y of [52,63,67,89,93,97,103,107,111])for(let x=113;x<=143;x++){
      if(capitalStreet(x,y)||x>=120&&x<=125&&y>=100||taken.has(x+','+y)||Math.hypot(x+.5-capitalPlaza.x,y+.5-capitalPlaza.y)<6.2||hash(x,y,8123)<.72)continue;
      add('ctree',x,y,1,1);taken.add(x+','+y);taken.add((x+1)+','+y);
    }
    return list;
  }
  // Courtyard props block movement; each covers whole tiles so collision matches the art.
  const kingdomDecor=kingdoms.flatMap(k=>k.bounds?capitalLayout(k):[{kingdom:k.id,kind:'fountain',x:k.x-8,y:k.y+2,w:2,h:2},{kingdom:k.id,kind:'stall',x:k.x+7,y:k.y+3,w:2,h:1}]);
  for(const k of kingdoms.filter(k=>!k.bounds))for(const dx of [-14,11])for(const dy of [-9,-3,6,9])kingdomDecor.push({kingdom:k.id,kind:'house',x:k.x+dx,y:k.y+dy,w:3,h:2,variant:Math.abs(dx+dy)});
  const decorIndex=new Map();for(const d of kingdomDecor)for(let y=d.y;y<d.y+d.h;y++)for(let x=d.x;x<d.x+d.w;x++)decorIndex.set(x+','+y,d);
  // Houses residents sleep in (capital houses from the decor layout).
  let housesCache=null;function houseList(){return housesCache||=[...new Set(decorIndex.values())].filter(d=>d.kind==='house');}
  function decorAt(x,y){return decorIndex.get(Math.floor(x)+','+Math.floor(y));}
  function kingdomAt(x,y){return kingdoms.find(k=>k.bounds?x>=k.bounds.x0&&x<k.bounds.x1+1&&y>=k.bounds.y0&&y<k.bounds.y1+1:Math.abs(x-k.x)<17&&y>k.y-14&&y<k.y+13);}
  function capitalTile(k,x,y,b){const B=k.bounds;
    if(x===B.x0||x===B.x1||y===B.y0||y===B.y1){if((y===B.y1||y===B.y0)&&Math.abs(x-128)<=2)return {kind:'path',biome:b,cobble:true,gate:true};return {kind:'citywall',biome:b,side:y===B.y0?'n':y===B.y1?'s':x===B.x0?'w':'e'};}
    const d=decorAt(x,y);if(d)return {kind:'grass',biome:b,decor:true,lawn:true};
    return capitalStreet(x,y)?{kind:'path',biome:b,cobble:true}:{kind:'grass',biome:b,lawn:true};}
  function royalAudience(w,p,k){const s=stats(p);p.hp=s.hp;p.mana=s.mana;if(!p.visited.includes(k.id))p.visited.push(k.id);p.dialog={kind:'royal',kingdom:k.id,title:k.name,text:'A corte oferece hospitalidade. Sua vida e mana foram restauradas. Explore o palácio e siga sua jornada.'};}
  for(const k of kingdoms){landmarks.push({id:k.id,name:k.name,x:k.x,y:k.y,kind:'kingdom'});buildings.push({x:k.x-7,y:k.y-10,w:14,h:9,kind:'palace',kingdom:k.id,name:k.name.toUpperCase()});}
  // Each palace door leads to its own castle interior, placed beyond the east edge of the map.
  if(Palace)kingdoms.forEach((k,i)=>expeditions.push({id:'palace-'+k.id,name:'Palácio de '+k.name.replace(/^Reino de /,''),kind:'palace',kingdom:k.id,x:k.x,y:k.y-.3,rx:3200,ry:i*(Palace.H+10),w:Palace.W,h:Palace.H}));
  const palaceOf=id=>expeditions.find(d=>d.kind==='palace'&&d.kingdom===id);
  // Capital taverns: walk up to the front door (or press E) to enter the taproom.
  if(Palace)[...new Set(decorIndex.values())].filter(d=>d.kind==='tavern').forEach((d,i)=>{const k=kingdoms.find(k=>k.id===d.kingdom);expeditions.push({id:'tavern-'+d.kingdom+'-'+i,name:'Taverna de '+(k?k.name.replace(/^Reino de /,''):'Véspera'),kind:'tavern',kingdom:d.kingdom,x:d.x+d.w/2,y:d.y+d.h+.3,door:{x:d.x+d.w/2,y:d.y+d.h+.3},rx:3350,ry:i*(Palace.TH+8),w:Palace.TW,h:Palace.TH});});
  function tavernNear(x,y){return expeditions.find(d=>d.kind==='tavern'&&Math.hypot(x-d.door.x,y-d.door.y)<1.3);}
  function buildingAt(x,y){return buildings.find(b=>x>=b.x&&x<b.x+b.w&&y>=b.y&&y<b.y+b.h);}
  function doorNear(x,y){return buildings.find(b=>Math.hypot(x-(b.x+b.w/2),y-(b.y+b.h+.35))<1.3);}
  function roomWalkable(b,x,y){
    const rx=x-b.x,ry=y-b.y;
    const doorway=Math.abs(rx-b.w/2)<.48&&ry>b.h-.6;
    return doorway||(rx>.35&&rx<b.w-.35&&ry>1.05&&ry<b.h-.35);
  }
  function hash(x,y,seed=719){let h=Math.imul(x+seed,374761393)^Math.imul(y-seed,668265263);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;}
  function biomeAt(x,y) {
    if(Frontier&&!inHeart(x,y))return Frontier.biome(x,y);
    if(Math.hypot(x-128,y-128)<24)return 0;
    const regions=[[128,128],[187,99],[191,177],[128,219],[48,203],[36,120],[65,42],[176,35]];
    const wx=x+Math.sin(y*.055)*9+Math.sin(y*.13)*3,wy=y+Math.sin(x*.061)*8;
    let best=Infinity,result=0;
    regions.forEach(([cx,cy],i)=>{const distance=(wx-cx)**2+(wy-cy)**2;if(distance<best){best=distance;result=i;}});
    return result;
  }
  function landmarkAt(x,y,range=1.8){return landmarks.find(l=>Math.hypot(l.x+.5-x,l.y+.5-y)<range&&l.kind!=='town');}
  // Roads between kingdoms, in front of buildings, around landmarks and the two main axes.
  function roadAt(x,y){return kingdoms.some(k=>{const roadX=k.x+(k.y>128?7:0),joinY=k.y>128?142:128;return Math.abs(x-roadX)<1.2&&y>=Math.min(k.y,joinY)&&y<=Math.max(k.y,joinY)||Math.abs(y-k.y)<1.2&&x>=k.x&&x<=roadX||k.y>128&&Math.abs(y-joinY)<1.2&&x>=roadX&&x<=128;})||buildings.some(z=>Math.abs(x+.5-(z.x+z.w/2))<1.6&&y>=z.y+z.h&&y<z.y+z.h+3)||landmarks.some(l=>Math.hypot(l.x-x,l.y-y)<(l.kind==='town'?2.2:l.kind==='deep'?3.4:1.8))||Math.abs(y-128)<.8||Math.abs(x-128)<.8||Math.abs(x-300.5)<1.1&&y>=119&&y<=128;}
  // Keep a one-tile verge beside every road so tree crowns never cover the way.
  function roadVerge(x,y){return kingdomAt(x+1,y)||kingdomAt(x-1,y)||kingdomAt(x,y+1)||kingdomAt(x,y-1)||roadAt(x+1,y)||roadAt(x-1,y)||roadAt(x,y+1)||roadAt(x,y-1)||roadAt(x+1,y+1)||roadAt(x-1,y+1);}
  function tileAt(x,y,seed=719){
    x=Math.floor(x);y=Math.floor(y);const b=biomeAt(x,y),n=hash(x,y,seed);
    const dungeon=dungeonAt(x,y);if(dungeon?.kind==='palace'||dungeon?.kind==='tavern')return Palace.tile(dungeon,x,y,b);if(dungeon?.kind==='lair'){const c=lairCell(x,y)||{kind:'wall',theme:'wall'};return {kind:c.kind,biome:b,underground:true,deep:true,lair:true,theme:c.theme,area:c.area,ore:c.ore??0,prop:c.prop,fx:c.fx,fy:c.fy,fw:c.fw,fh:c.fh,decor:!!c.block,bones:c.bones};}if(dungeon?.kind==='citadel'){const c=citadelCell(x,y);return {kind:c.kind,biome:b,underground:true,deep:true,citadel:true,theme:c.theme,area:c.area,ore:c.ore??0};}if(dungeon?.kind==='deep'){const c=abyssCell(x,y);return {kind:c.kind,biome:b,underground:true,deep:true,theme:c.theme,area:c.area,ore:c.ore??0};}if(dungeon){const dx=x-dungeon.rx,dy=y-dungeon.ry,edge=dx===0||dy===0||dx===dungeon.w-1||dy===dungeon.h-1;const ore= !edge&&!landmarks.some(l=>Math.hypot(l.x-x,l.y-y)<2)&&dungeon.kind==='cave'&&dx>2&&dx<dungeon.w-3&&dy>2&&dy<dungeon.h-5&&dx%4===0&&dy%3===0;return {kind:edge?'wall':ore?'rock':'cavefloor',biome:b,underground:true,theme:dungeon.id==='frost-raid'?'frost':undefined,ore:Math.min(15,dungeon.tier*2+(hash(x,y,seed)>.5?1:0))};}
    if(x<WORLD.x0+3||y<WORLD.y0+3||x>=WORLD.x1-3||y>=WORLD.y1-3)return {kind:'water',biome:b};
    const outside=Frontier&&!inHeart(x,y);
    const nearTown=Math.hypot(x-128,y-128)<12;
    for(const z of buildings)if(x>=z.x&&x<z.x+z.w&&y>=z.y&&y<z.y+z.h)return {kind:'building',biome:b};
    const kingdom=kingdomAt(x,y);if(kingdom?.bounds)return capitalTile(kingdom,x,y,b);if(kingdom&&decorAt(x,y))return {kind:'grass',biome:b,decor:true};if(kingdom)return {kind:Math.abs(x-kingdom.x)<2||Math.abs(y-kingdom.y)<2?'path':'grass',biome:b};
    if(roadAt(x,y))return {kind:outside&&Frontier.river(x,y)?'bridge':'path',biome:b};
    if(outside){const camp=Frontier.campAt(x,y);if(camp)return {kind:'grass',biome:b,decor:true,camp:camp.camp,prop:camp.prop,fx:camp.fx,fy:camp.fy,fw:camp.fw,fh:camp.fh};
      const r=Frontier.river(x,y);if(r)return {kind:r,biome:b};if(Frontier.lake(x,y,b))return {kind:'water',biome:b};}
    else{const river=158+Math.sin(y*.045)*6;
    if(Math.abs(x-river)<2.2)return {kind:Math.abs(y-160)<2?'bridge':'water',biome:b};
    if(!nearTown&&![3,4,6].includes(b)&&Math.sin(x*.067)+Math.cos(y*.076)>(b===2?1.2:1.79))return {kind:'water',biome:b};}
    if(nearTown){
      if([[118,132],[124,120],[127,117],[138,122],[140,126],[140,136],[130,138],[125,137],[120,119]].some(([tx,ty])=>tx===x&&ty===y))return {kind:'tree',biome:b};
      return {kind:(x>134&&x<140&&y>127&&y<134)?'farm':'grass',biome:b};
    }
    const climate=biomes[b];
    const treeShare=climate.trees*.55;
    if(n>1-climate.rocks-treeShare&&roadVerge(x,y))return {kind:'grass',biome:b};
    if(n>1-climate.rocks)return {kind:'rock',biome:b,ore:b*2+(hash(x+5,y,seed)>.5?1:0)};
    if(n>1-climate.rocks-treeShare)return {kind:'tree',biome:b};
    if(n<.025&&b!==3&&b!==4)return {kind:'herb',biome:b};
    if(n<.043&&b!==3&&b!==4&&b!==6)return {kind:'berry',biome:b};
    return {kind:'grass',biome:b};
  }
  function walkable(world,x,y){const tile=tileAt(x,y,world.seed);if(tile.kind==='building')return roomWalkable(buildingAt(x,y),x,y);if(tile.decor||tile.kind==='citywall'||tile.kind==='water'||tile.kind==='wall'||tile.kind==='lava'||tile.kind==='stal')return false;if(tile.kind==='seal')return tile.citadel?!!world.citadel?.open:tile.lair?!!world.lair?.open:!!world.deep?.sealOpen;if(['tree','rock'].includes(tile.kind)&&!(world.harvested[`${Math.floor(x)},${Math.floor(y)}`]>world.time))return false;return true;}
  function makeWorld(seed=719){return {version:2,seed,time:0,players:{},monsters:{},harvested:{},placed:[],graves:[],events:[],eventId:0,spawned:{},day:1};}
  // Custom looks (optional): the same paper-doll pieces the villagers use. Shared by saves, LAN and the host.
  const appearanceOptions=Object.freeze({
    body:['woman','man'],skin:['#f6d2b3','#eab893','#d19a6f','#b07650','#8a5634','#5f3a24'],
    hair:['short','long','bun','ponytail','braids','curly','bald','spiky'],
    hairColor:['#2a1f1a','#4a2f22','#9a5b2e','#c8843e','#e0b25c','#f1dc9a','#b8b2a8','#e9e6df','#a8342c','#3c4f7a'],
    beard:['none','mustache','goatee','full'],outfit:['tunic','coat','robe','dress','armor','noble'],
    main:[...new Set(['#3f6f8f','#7a3b3b','#4f7a45','#5c4a86','#2f5f5a','#9a4e6e','#b07a3a','#48526e','#6b3f2a','#c2a15a',...classes.map(c=>c.color)])],
    accent:['#e8d8b0','#c9a45c','#f1efe6','#b8c7d9','#d9a0a0','#9ad0b0','#e0c070'],
    hat:['none','hood','cap','bandana','straw','feather','wizard','helmet'],cape:[false,true]
  });
  function defaultLook(classId,appearance='female'){return {body:appearance==='male'?'man':'woman',skin:'#eab893',hair:appearance==='male'?'short':'ponytail',hairColor:'#9a5b2e',beard:'none',outfit:['mago','necromante','clerigo'].includes(classId)?'robe':['guardiao','paladino','guerreiro'].includes(classId)?'armor':'tunic',main:classById[classId]?.color||'#3f6f8f',accent:'#e8d8b0',hat:'none',cape:false};}
  function validLook(value){return !!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>Object.hasOwn(appearanceOptions,key)&&appearanceOptions[key].includes(value[key]));}
  function normalizeLook(value,classId,appearance){if(!validLook(value))throw new Error('Visual de personagem inválido.');return {...defaultLook(classId,appearance),...value};}
  function makePlayer(name,classId,id='solo',rng=Math.random,appearance='female',look){const custom=look==null?null:normalizeLook(look,classId,appearance);if(custom)appearance=custom.body==='man'?'male':'female';const c=classById[classId];if(!c)throw new Error('Classe inválida.');const surnames=playableHouses.map(h=>h.surname);return {id,...(custom?{look:custom}:{}),appearance:appearance==='male'?'male':'female',name:String(name).trim().slice(0,24)||'Viajante',surname:surnames[Math.floor(rng()*surnames.length)],classId,x:SPAWN.x,y:SPAWN.y,dir:0,hp:c.hp,mana:c.mana,level:1,xp:0,gold:35,inventory:{wood:6,stone:4,fiber:5,herb:3,potion:3,seed:4,ore0:3},equipment:{weapon:null,armor:null,head:null,feet:null,charm:null},kills:0,crafted:0,gathered:0,quest:0,visited:['village'],journal:[],shrineDone:[],buffs:{},cooldowns:{},input:{x:0,y:0,until:0},lastSeq:0,attackAt:-5,hurtAt:-5,dead:false,online:true,dialog:null,discovered:{},chestOpened:false,deaths:0};}
  function stats(p){const c=classById[p.classId];const s={hp:c.hp+(p.level-1)*9,mana:c.mana+(p.level-1)*5,atk:c.atk+(p.level-1)*2,def:c.def+(p.level-1),speed:c.speed,crit:c.crit,range:c.range};for(const id of Object.values(p.equipment)){const item=items[id];if(!item)continue;for(const key of ['atk','def','hp','speed','crit'])s[key]+=item[key]||0;if(item.slot==='weapon')s.range=item.range;}const a=p.attributes||{};s.atk+=(a.strength||0)*2;s.hp+=(a.vitality||0)*10;s.def+=(a.vitality||0)*.5;s.mana+=(a.spirit||0)*8;s.speed+=(a.agility||0)*.06;s.crit=Math.min(.75,s.crit+(a.agility||0)*.005+(a.perception||0)*.01);s.range+=(a.perception||0)*.05;const t=p.progress?.talents||{};s.hp+=(t.vigor||0)*8;s.atk+=(t.power||0)*2;s.mana+=(t.spirit||0)*10;if(p.progress?.mounted)s.speed*={horse:1.35,patrasche:1.5,qilin:1.5,fenrir:1.6}[p.progress.mountKind||'horse']||1.35;if(Isekai)Isekai.applyStats(p,s);s.speed=Math.max(2,s.speed);return s;}
  function equipmentChange(p,id){const item=items[id];if(item?.type!=='equipment')return {};const before=stats(p),after=stats({...p,equipment:{...p.equipment,[item.slot]:id}});return Object.fromEntries(Object.keys(before).map(key=>[key,Math.round((after[key]-before[key])*100)/100]));}
  function clearShot(w,a,b,magic=false){const distance=Math.hypot(b.x-a.x,b.y-a.y),steps=Math.ceil(distance*5);for(let i=1;i<steps;i++){const x=a.x+(b.x-a.x)*i/steps,y=a.y+(b.y-a.y)*i/steps,t=tileAt(x,y,w.seed);if(t.kind==='building'||t.kind==='wall'||t.kind==='stal'||(t.kind==='seal'&&!w.deep?.sealOpen))return false;if(!magic&&['tree','rock'].includes(t.kind)&&!(w.harvested[`${Math.floor(x)},${Math.floor(y)}`]>w.time))return false;}return true;}
  function combatTarget(w,p,targetId){const magic=usesMagic(p),candidates=nearEnemies(w,p,stats(p).range);return (targetId==null?candidates:candidates.filter(m=>m.id===targetId)).find(m=>clearShot(w,p,m,magic))||null;}
  function validSave(saved){const w=saved?.world,p=w?.players?.[saved?.me];return !!(w?.version===2&&Number.isFinite(w.seed)&&Number.isFinite(w.time)&&p&&Object.hasOwn(classById,p.classId)&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&(p.x>=WORLD.x0&&p.y>=WORLD.y0&&p.x<WORLD.x1&&p.y<WORLD.y1||['palace','tavern','lair'].includes(dungeonAt(p.x,p.y)?.kind))&&(p.look===undefined||validLook(p.look))&&Number.isFinite(p.hp)&&Number.isInteger(p.level)&&p.level>0&&Number.isInteger(p.quest)&&p.quest>=0&&p.quest<quests.length&&p.inventory&&p.equipment&&p.cooldowns&&p.buffs&&p.discovered&&Array.isArray(p.journal)&&Array.isArray(p.shrineDone)&&Array.isArray(p.visited)&&w.monsters&&w.harvested&&w.spawned&&Array.isArray(w.events)&&Array.isArray(w.placed)&&Array.isArray(w.graves));}
  function event(w,type,x,y,text,color='#fff',who=null){w.events.push({id:++w.eventId,type,x,y,text,color,who,time:w.time});if(w.events.length>100)w.events.shift();}
  function notify(w,p,text){event(w,'notice',p.x,p.y,text,'#e5cc91',p.id);}
  function give(p,id,n=1){p.inventory[id]=(p.inventory[id]||0)+n;}
  function consume(p,id,n=1){if((p.inventory[id]||0)<n)return false;p.inventory[id]-=n;if(!p.inventory[id])delete p.inventory[id];return true;}
  function gainXP(w,p,n){p.xp+=Isekai?Math.round(n*Isekai.xpMult(p)):n;while(p.xp>=p.level*55){p.xp-=p.level*55;p.level++;const s=stats(p);p.hp=s.hp;p.mana=s.mana;if(Isekai)Isekai.system(w,p,`Nível ${p.level} alcançado! Vida e mana restauradas.`,'level');else notify(w,p,`Nível ${p.level}! Vida e mana restauradas.`);event(w,'level',p.x,p.y,'NOVO NÍVEL','#f8d778');}}
  function die(w,p){if(p.dead)return;p.dead=true;p.hp=0;p.input={x:0,y:0,until:0};p.deaths++;const gold=Math.floor(p.gold*.2);p.gold-=gold;w.graves=w.graves.filter(g=>g.owner!==p.id);w.graves.push({owner:p.id,x:p.x,y:p.y,gold});event(w,'death',p.x,p.y,'A estrada escureceu.','#d7cde1');p.dialog=null;}
  function hurt(w,p,amount,status){if(p.dead||p.buffs.invincible>w.time)return;if(p.buffs.parry>w.time){event(w,'hit',p.x,p.y,'APARADO','#d9efff',p.id);p.mana=Math.min(stats(p).mana,p.mana+5);return;}const s=stats(p);const shield=p.buffs.shield>w.time?12:0;const damage=Math.max(1,Math.round((amount-s.def*.6-shield)*(p.buffs.aegis>w.time?.5:1)));p.metrics||={};p.metrics.damageTaken=(p.metrics.damageTaken||0)+Math.min(p.hp,damage);p.hp=Math.max(0,p.hp-damage);p.hurtAt=w.time;delete p.activity;if(p.progress)p.progress.fishing=null;p.buffs.invincible=w.time+.65;if(status)p.buffs[status]=w.time+5;event(w,'damage',p.x,p.y,'−'+damage,'#f1a59c',p.id);if(p.hp<=0)die(w,p);}
  const monsterTypes={
    duneWraith:{name:'Espectro das Dunas',hp:72,atk:21,speed:2.2,color:'#e3c18b',xp:38,drop:'essence'},
    glacierHound:{name:'Cão da Geada',hp:92,atk:24,speed:2.4,color:'#9ecfe2',xp:49,drop:'ore8'},
    // Road bandits: humans who ambush travellers at night outside the towns.
    bandit:{name:'Bandido da estrada',hp:95,atk:21,speed:2.4,color:'#5a3f36',xp:45,drop:'leather',human:true},
    // Mystical creatures: rare, one per biome, tameable through the pact; three of them become mounts.
    fenrir:{name:'Fenrir',hp:240,atk:34,speed:2.6,color:'#bcd6e8',xp:150,drop:'ore8',mystic:true},patrasche:{name:'Patrasche, dragão terrestre',hp:190,atk:28,speed:2.8,color:'#3a3a44',xp:120,drop:'leather',mystic:true},qilin:{name:'Qilin',hp:200,atk:30,speed:2.5,color:'#5fc39a',xp:130,drop:'essence',mystic:true},salamander:{name:'Salamandra',hp:120,atk:26,speed:1.8,color:'#e0582e',xp:80,drop:'coal',mystic:true},kitsune:{name:'Kitsune',hp:130,atk:24,speed:2.4,color:'#e9e6ff',xp:90,drop:'essence',mystic:true},phoenix:{name:'Fênix',hp:170,atk:30,speed:2.3,color:'#f0833a',xp:120,drop:'ore10',mystic:true},cerberus:{name:'Cérbero',hp:220,atk:33,speed:2.2,color:'#3a2c34',xp:140,drop:'ore6',mystic:true},nekomata:{name:'Nekomata',hp:110,atk:22,speed:2.5,color:'#6a4a9a',xp:75,drop:'essence',mystic:true},necromancer:{name:'Acólito das almas',hp:115,atk:25,speed:1.3,color:'#8ed6c7',xp:48,drop:'essence'},slime:{name:'Limo do vale',hp:30,atk:9,speed:1.25,color:'#a1cb70',xp:16,drop:'slime'},wolf:{name:'Lobo de musgo',hp:55,atk:15,speed:2.2,color:'#b9b2a0',xp:25,drop:'leather'},wisp:{name:'Fagulha errante',hp:42,atk:18,speed:1.6,color:'#b5a0e0',xp:27,drop:'essence'},scarab:{name:'Besouro de areia',hp:65,atk:17,speed:1.7,color:'#d0ad6a',xp:28,drop:'ore6'},ice:{name:'Guardião de gelo',hp:80,atk:21,speed:1.4,color:'#b5dbe5',xp:35,drop:'ore8'},ember:{name:'Brasa viva',hp:85,atk:24,speed:1.9,color:'#e39a76',xp:40,drop:'coal'},boss:{name:'O Último Esquecido',title:'Guardião do Jardim das Estrelas',house:'aurora',boss:true,hp:650,atk:35,speed:1.5,color:'#bb9ce0',xp:350,drop:'ore15',status:'slow',summon:'necromancer',trophy:'trofeu-estrelas',mechanic:'Deixa os golpeados lentos e invoca vigias das almas na metade da vida.'},
    rootBoss:{name:'Barão Cardo Espinheiro',title:'Senhor das Raízes',house:'espinheiro',boss:true,art:'boss',hpMul:1,hp:340,atk:27,speed:1.35,color:'#8fbf6a',xp:220,drop:'ore5',status:'slow',summon:'wolf',trophy:'trofeu-raizes',mechanic:'Raízes deixam os golpeados lentos. Em fúria, chama lobos de musgo.'},
    ashBoss:{name:'Condessa Ísis Valcinza',title:'Rainha das Cinzas',house:'valcinza',boss:true,art:'boss',hpMul:1.1,ranged:true,hp:500,atk:34,speed:1.45,color:'#ef8a5c',xp:320,drop:'ore13',status:'poison',summon:'ember',trophy:'trofeu-cinzas',mechanic:'Lança brasas à distância que queimam. Em fúria, invoca brasas vivas.'},
    frostBoss:{name:'Hrokk, o Yeti',title:'Guardião do Templo do Gelo',boss:true,art:'yeti',hpMul:1.2,hp:430,atk:31,speed:1.2,color:'#9fd3e6',xp:280,drop:'ore9',status:'slow',summon:'ice',trophy:'trofeu-geada',mechanic:'Punhos glaciais causam lentidão. Na metade da vida, o Yeti invoca sentinelas de gelo.'},
    tideBoss:{name:'Marta Juncal',title:'Matriarca do Lodo',house:'juncal',boss:true,art:'boss',hpMul:1,ranged:true,hp:380,atk:26,speed:1.5,color:'#97b073',xp:250,drop:'ore7',status:'poison',summon:'wisp',trophy:'trofeu-lodo',mechanic:'Cospe lodo venenoso à distância. Em fúria, liberta fagulhas errantes.'}};
  Object.assign(monsterTypes,{
    brambleBoar:{name:'Javali de espinhos',hp:115,atk:23,speed:2.1,color:'#799a53',xp:65,drop:'leather',mystic:true},
    mossTurtle:{name:'Tartaruga de musgo',hp:180,atk:17,speed:1.1,color:'#7f9c5c',xp:72,drop:'essence',mystic:true},
    moonMoth:{name:'Mariposa lunar',hp:105,atk:21,speed:2.3,color:'#b9acd8',xp:68,drop:'essence',mystic:true},
    glassScorpion:{name:'Escorpião de vidro',hp:125,atk:28,speed:2.0,color:'#d8b16e',xp:82,drop:'ore6',mystic:true},
    frostLynx:{name:'Lince da geada',hp:145,atk:27,speed:2.6,color:'#a8d5ed',xp:90,drop:'ore8',mystic:true},
    crystalStag:{name:'Cervo de cristal',hp:165,atk:24,speed:2.4,color:'#b494d9',xp:100,drop:'ore10',mystic:true},
    stormHawk:{name:'Falcão da tempestade',hp:120,atk:27,speed:2.8,color:'#658dcd',xp:86,drop:'essence',mystic:true},
    totem:{name:'Totem Ancestral',hp:240,atk:0,speed:0,color:'#d9a441',xp:70,drop:'essence',inert:true},
    shade:{name:'Sombra da cidadela',hp:58,atk:16,speed:2.1,color:'#8a78c0',xp:24,drop:'essence',art:'wisp'},
    greatTotem:{name:'Grande Totem',title:'Coração da Cidadela',boss:true,hp:1500,atk:32,speed:0,ranged:true,color:'#e8b04a',xp:700,drop:'ore14',status:'poison',summon:'shade',trophy:'trofeu-totem',mechanic:'Não se move. Dispara faíscas envenenadas e chama sombras. Na metade da vida, os quatro rostos acordam.'},
    goblin:{name:'Goblin saqueador',hp:78,atk:19,speed:2.3,color:'#8aaf62',xp:35,drop:'ore4'},
    goblinShaman:{name:'Xamã goblin',hp:100,atk:24,speed:1.5,ranged:true,color:'#bf9180',xp:48,drop:'essence',status:'poison'},
    // Covil dos Goblins and the camps of the frontier.
    goblinArcher:{name:'Arqueiro goblin',hp:66,atk:17,speed:2.1,ranged:true,color:'#b09a5a',xp:32,drop:'fiber',art:'goblin'},
    goblinBrute:{name:'Brutamontes goblin',hp:170,atk:26,speed:1.6,color:'#6d8a45',xp:55,drop:'leather',art:'goblin',size:64},
    murk:{name:'Murk',title:'Xamã do Caldeirão',boss:true,ranged:true,art:'goblinShaman',size:84,hp:720,atk:28,speed:1.5,color:'#8fc070',xp:380,drop:'essence',status:'poison',summon:'goblin',mechanic:'Lança maldições venenosas à distância. Em fúria, chama goblins do caldeirão.'},
    grol:{name:'Grol',title:'Campeão da Tribo',boss:true,art:'goblin',size:92,hp:950,atk:34,speed:1.45,color:'#7a9a44',xp:420,drop:'ore3',status:'slow',summon:'goblinBrute',mechanic:'Golpes de clava que deixam lento. Em fúria, chama brutamontes.'},
    goblinKing:{name:'Gorzak',title:'Rei Goblin',boss:true,art:'goblin',size:112,hp:1700,atk:40,speed:1.5,color:'#d4b04a',xp:800,drop:'ore5',summon:'goblinArcher',trophy:'trofeu-goblin',mechanic:'O rei ataca com um machado de ouro. Em fúria, os arqueiros da guarda descem do trono.'},
    bat:{name:'Morcego das profundezas',hp:38,atk:13,speed:2.7,color:'#9a86bb',xp:22,drop:'leather'},
    spider:{name:'Aranha tecelã',hp:62,atk:17,speed:2.1,color:'#8a7299',xp:30,drop:'fiber',status:'poison'},
    golem:{name:'Golem de cristal',hp:130,atk:24,speed:1.1,color:'#8fd0dc',xp:45,drop:'ore10'},
    spiderQueen:{name:'Aracne',title:'Tecelã Rainha',boss:true,hp:900,atk:30,speed:1.6,color:'#a684d0',xp:420,drop:'essence',status:'poison',summon:'spider',trophy:'trofeu-aracne',mechanic:'Mordidas venenosas. Em fúria, desce aranhas do teto.'},
    colossus:{name:'Colosso de Ametista',title:'Guardião do Geodo',boss:true,hp:1200,atk:36,speed:1,color:'#b48be0',xp:480,drop:'ore9',status:'slow',summon:'golem',trophy:'trofeu-colosso',mechanic:'Golpes pesados que deixam lento. Em fúria, desperta golens de cristal.'},
    batQueen:{name:'Vesperalba',title:'Rainha dos Morcegos',boss:true,ranged:true,hp:800,atk:28,speed:2.3,color:'#cf7eaa',xp:440,drop:'leather',summon:'bat',trophy:'trofeu-vesperalba',mechanic:'Rasantes rápidos à distância. Em fúria, a revoada inteira acorda.'},
    // Hunting grounds (huntZones below). Kinds with `art` fall back to a tinted look-alike until assets/mon-<kind>.png exists.
    mushroom:{name:'Cogumelo andante',hp:70,atk:15,speed:1.6,color:'#d9774a',xp:28,drop:'herb',art:'slime',size:42,status:'poison'},
    harpy:{name:'Harpia',hp:105,atk:23,speed:2.9,color:'#b88a6a',xp:58,drop:'fiber',art:'stormHawk',size:58,ranged:true},
    wraith:{name:'Espectro',hp:95,atk:24,speed:2.5,color:'#6a5a9a',xp:55,drop:'essence',art:'wisp',size:60},
    soulWarden:{name:'Vigia das Almas',title:'Guardião da Cripta',boss:true,ranged:true,art:'necromancer',size:108,hp:900,atk:34,speed:1.5,color:'#7fd6b0',xp:520,drop:'essence',status:'poison',summon:'skeleton',mechanic:'Lança maldições à distância. Em fúria, ergue esqueletos do chão.'},
    slimeKing:{name:'Rei Limo',title:'Majestade Gelatinosa',boss:true,art:'slime',size:104,hp:600,atk:24,speed:1.3,color:'#7ccf6a',xp:300,drop:'slime',summon:'slime',mechanic:'Esmaga o chão. Em fúria, se divide em limos menores.'},
    minotaurKing:{name:'Rei Minotauro',title:'Senhor do Labirinto',boss:true,art:'goblin',size:124,hp:1500,atk:44,speed:1.6,color:'#9a4a2a',xp:780,drop:'ore10',status:'slow',summon:'minotaur',mechanic:'Investidas brutais que deixam lento. Em fúria, chama minotauros.'},
    bloodKnight:{name:'Cavaleiro Sangrento',title:'Espada do Castelo Sombrio',boss:true,art:'necromancer',size:112,hp:1700,atk:46,speed:1.9,color:'#c0303a',xp:860,drop:'ore12',summon:'skeleton',mechanic:'Golpes rápidos e pesados. Em fúria, a guarda de esqueletos volta a marchar.'},
    demonLord:{name:'Senhor Demônio',title:'Rei da Fenda',boss:true,ranged:true,art:'demon',size:140,hp:2400,atk:50,speed:1.5,color:'#d0304a',xp:1100,drop:'ore15',status:'poison',summon:'hellhound',mechanic:'Chamas infernais à distância. Em fúria, abre a fenda e solta cães infernais.'},
    dragonkin:{name:'Draconiano',hp:210,atk:31,speed:2.1,color:'#4f6b3c',xp:115,drop:'leather',size:78},
    demon:{name:'Arquidemônio',hp:420,atk:38,speed:1.7,color:'#b8406a',xp:260,drop:'ore11',size:104,status:'poison'},
    gargoyle:{name:'Gárgula',hp:150,atk:26,speed:2.2,color:'#6f8a4e',xp:70,drop:'stone',size:62},
    sylph:{name:'Sílfide da folhagem',hp:90,atk:20,speed:2.8,color:'#8fc07a',xp:52,drop:'essence',ranged:true,size:46},
    skeleton:{name:'Soldado esqueleto',hp:95,atk:20,speed:2,color:'#d8d2bc',xp:40,drop:'ore2',art:'necromancer',size:58},
    orc:{name:'Orc de ferro',hp:190,atk:29,speed:1.9,color:'#6f8a45',xp:85,drop:'ore4',art:'goblin',size:70},
    iceElf:{name:'Elfo do gelo',hp:130,atk:27,speed:2.4,ranged:true,color:'#9fd3f0',xp:80,drop:'ore8',art:'necromancer',size:60,status:'slow'},
    lizardman:{name:'Homem-lagarto',hp:140,atk:24,speed:2.3,color:'#5f9a64',xp:66,drop:'leather',art:'goblin',size:58},
    hellhound:{name:'Cão infernal',hp:120,atk:28,speed:3,color:'#c8503a',xp:72,drop:'coal',art:'wolf',size:54},
    antSoldier:{name:'Formiga guerreira',hp:110,atk:24,speed:2.5,color:'#b0473a',xp:60,drop:'fiber',art:'scarab',size:50},
    naga:{name:'Naga do pântano',hp:170,atk:26,speed:1.9,ranged:true,color:'#4fa39a',xp:88,drop:'essence',art:'salamander',size:64,status:'poison'},
    minotaur:{name:'Minotauro',hp:320,atk:36,speed:1.8,color:'#8a5a3a',xp:160,drop:'ore6',art:'goblin',size:92,status:'slow'},
    antKing:{name:'Rei das Formigas',title:'Senhor da Colônia',boss:true,hp:1400,atk:42,speed:2.1,color:'#7a3fb0',xp:750,drop:'ore12',art:'scarab',size:110,status:'poison',summon:'antSoldier',mechanic:'Rápido e venenoso. Em fúria, chama a colônia inteira.'},
    wyrm:{name:'Ignarok',title:'Wyrm de Magma',boss:true,ranged:true,hp:2000,atk:44,speed:1.3,color:'#f07a3a',xp:900,drop:'ore15',status:'poison',summon:'ember',trophy:'trofeu-ignarok',mechanic:'Sopra fogo à distância que queima. Em fúria, o magma cospe brasas vivas.'}
  });
  [['trofeu-aracne','Manto de seda de Aracne','armor','#a684d0',{def:7,hp:35,speed:.1},'Troféu de Aracne. Leve como teia e mais forte que aço.'],
   ['trofeu-colosso','Elmo de ametista','head','#b48be0',{def:9,hp:45},'Troféu do Colosso de Ametista. Zumbe baixinho perto de cristais.'],
   ['trofeu-vesperalba','Botas de Vesperalba','feet','#cf7eaa',{def:3,speed:.3,crit:.05},'Troféu de Vesperalba. Seus passos não fazem som.'],
   ['trofeu-ignarok','Lâmina de Ignarok','weapon','#f07a3a',{atk:38,range:2,crit:.08},'Troféu de Ignarok. O fio nunca esfria.'],
   ['trofeu-goblin','Coroa do Rei Goblin','head','#d4b04a',{atk:6,def:6,hp:30},'Troféu de Gorzak. Torta, pesada e surpreendentemente resistente.']
  ].forEach(([id,name,slot,color,st,desc])=>add({id,name,type:'equipment',slot,tier:10,color,atk:st.atk||0,def:st.def||0,hp:st.hp||0,speed:st.speed||0,range:st.range||0,crit:st.crit||0,unique:true,desc}));
  function lairBossDown(w,p,m){const t=monsterTypes[m.kind];w.deep||={slain:{}};w.deep.slain||={};const first=!w.deep.slain[m.kind];w.deep.slain[m.kind]=true;
    const team=Object.values(w.players).filter(q=>!q.dead&&dungeonAt(q.x,q.y)===abyss&&Math.hypot(q.x-m.x,q.y-m.y)<24);if(!team.includes(p))team.push(p);
    for(const q of team){if(!q.trophies?.includes(t.trophy)){(q.trophies||=[]).push(t.trophy);give(q,t.trophy);notify(w,q,'Troféu: '+items[t.trophy].name);}q.abyssSlain||={};q.abyssSlain[m.kind]=(q.abyssSlain[m.kind]||0)+1;}
    if(m.kind==='wyrm'){for(const q of team){q.gold+=300;gainXP(w,q,300);notify(w,q,'Ignarok caiu! O Abismo de Véspera está em silêncio. +300 moedas');}return;}
    if(!w.deep.sealOpen&&abyssGuardians.every(k=>w.deep.slain[k])){w.deep.sealOpen=true;for(const q of Object.values(w.players))if(dungeonAt(q.x,q.y)===abyss)notify(w,q,'Os três guardiões caíram. O selo do Coração de Magma se rompeu!');}
    else if(first&&!w.deep.sealOpen)for(const q of team)notify(w,q,'Guardiões derrotados: '+abyssGuardians.filter(k=>w.deep.slain[k]).length+'/3. O selo enfraquece.');}
  function isBoss(m){return !!monsterTypes[m?.kind]?.boss;}
  function bossLineage(kind){const t=monsterTypes[kind];if(!t?.boss)return '';const h=houseById[t.house];return h?h.title+' · '+h.status:(t.title||'');}
  [['trofeu-raizes','Coroa de espinhos Espinheiro','head','#8fbf6a',{atk:4,def:5,hp:22},'Troféu do Barão Cardo Espinheiro. Os espinhos só ferem quem não merece usá-la.'],
   ['trofeu-cinzas','Anel de brasa Valcinza','charm','#ef8a5c',{atk:10,crit:.05},'Troféu da Condessa Ísis Valcinza. Ainda está quente.'],
   ['trofeu-geada','Martelo do inverno','weapon','#9fd3e6',{atk:27,speed:-.1,range:1.6},'Troféu de Hrokk, o Yeti. Cada golpe range como gelo quebrando.'],
   ['trofeu-lodo','Manto do Juncal','armor','#97b073',{def:6,hp:30,speed:.08},'Troféu de Marta Juncal. Seco por fora, cheio de bolsos por dentro.'],
   ['trofeu-totem','Máscara do Grande Totem','charm','#e8b04a',{atk:10,def:4,hp:50,crit:.04},'Troféu do Grande Totem. Os quatro rostos ainda sussurram direções.'],
   ['trofeu-estrelas','Amuleto da Aurora','charm','#bb9ce0',{atk:6,def:3,hp:40},'Troféu do Último Esquecido. Guarda o nome de uma casa inteira.']
  ].forEach(([id,name,slot,color,st,desc])=>add({id,name,type:'equipment',slot,tier:9,color,atk:st.atk||0,def:st.def||0,hp:st.hp||0,speed:st.speed||0,range:st.range||0,crit:st.crit||0,unique:true,desc}));
  function bossRage(w,m){const t=monsterTypes[m.kind];m.enraged=true;event(w,'warning',m.x,m.y,'FÚRIA',t.color);for(const p of Object.values(w.players))if(!p.dead&&Math.hypot(p.x-m.x,p.y-m.y)<40&&dungeonAt(p.x,p.y)===dungeonAt(m.x,m.y))notify(w,p,t.name+' entra em fúria!');
    if(!t.summon)return;const r=m.raid&&w.raids?.[m.raid];const minion=monsterTypes[t.summon];for(let i=0;i<2;i++){const id=m.id+':lacaio'+i,x=m.x+(i?2:-2),y=m.y+1,ok=walkable(w,x,y),px=ok?x:m.x,py=ok?y:m.y,hp=Math.round(minion.hp+m.tier*9);w.monsters[id]={id,kind:t.summon,x:px,y:py,homeX:px,homeY:py,hp,maxHp:hp,tier:m.tier,attack:0,hurtAt:-5,raid:m.raid,minion:true};if(r)r.ids.push(id);}}
  function hitMonster(w,p,m,damage){if(m.hp<=0)return;if(m.citadel&&m.shield&&w.monsters[m.shield]?.hp>0){event(w,'hit',m.x,m.y,'ESCUDO','#e8c15a');if(!(p.cooldowns.shieldNote>w.time)){p.cooldowns.shieldNote=w.time+4;notify(w,p,'Um totem protege '+monsterTypes[m.kind].name+'. Destrua o totem desta ala primeiro.');}return;}p.metrics||={};p.metrics.damageDealt=(p.metrics.damageDealt||0)+Math.min(m.hp,damage);m.hp-=damage;m.hurtAt=w.time;event(w,'hit',m.x,m.y,String(damage),'#fff2bf');if(Isekai)Isekai.onHit(w,p,m,damage);if(isBoss(m)&&!m.enraged&&m.hp>0&&m.hp<m.maxHp/2)bossRage(w,m);if(m.hp<=0){m.diedAt=w.time;p.kills++;if(p.classId==='monarca'&&!m.raid&&!monsterTypes[m.kind].inert&&!monsterTypes[m.kind].human){p.fallen=[...(p.fallen||[]),{kind:m.kind,x:m.x,y:m.y,t:w.time,tier:m.tier||0,boss:isBoss(m)}].slice(-10);}const loot=isBoss(m)?150:4+m.tier;p.gold+=familyOf(p).noble?Math.ceil(loot*1.5):loot;if(Isekai)Isekai.onKill(w,p,m,loot);if(isBoss(m))p.bossesSlain=(p.bossesSlain||0)+1;gainXP(w,p,monsterTypes[m.kind].xp+m.tier*2);give(p,monsterTypes[m.kind].drop,isBoss(m)?8:2);if(Trade){const parts=Trade.roll(w,p,m);if(parts.length)event(w,'loot',m.x,m.y-.5,parts.map(([id,n])=>'+'+(n>1?n+'× ':'')+items[id].name).join(' '),'#e8d4a0',p.id);Trade.recognize(w,p,m);}if(m.kind==='boss'&&!m.raid){p.bossKilled=true;if(!p.trophies?.includes('trofeu-estrelas')){(p.trophies||=[]).push('trofeu-estrelas');give(p,'trofeu-estrelas');}notify(w,p,'O santuário está livre. Volte para Íria.');}else if(isBoss(m))notify(w,p,monsterTypes[m.kind].name+' foi derrotado!');if(m.lair&&isBoss(m))lairBoss(w,p,m);else if(m.deep&&isBoss(m))lairBossDown(w,p,m);if(m.citadel)citadelDown(w,p,m);event(w,'loot',m.x,m.y,'+'+items[monsterTypes[m.kind].drop].name,'#c9df92',p.id);m.enraged=false;m.respawn=m.citadel&&(isBoss(m)||m.kind==='totem')?1e12:w.time+(isBoss(m)?300:70);}}
  function nearEnemies(w,p,range){return Object.values(w.monsters).filter(m=>m.hp>0&&Math.hypot(m.x-p.x,m.y-p.y)<range).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y));}
  function attack(w,p,rng,targetId){if(p.cooldowns.attack>w.time)return;const s=stats(p),target=combatTarget(w,p,targetId);p.cooldowns.attack=w.time+.48;p.attackAt=w.time;delete p.activity;if(p.progress)p.progress.fishing=null;let damage=s.atk+(p.buffs.rage>w.time?14:0);const critical=rng()<s.crit;if(critical)damage=Math.round(damage*1.8);if(Isekai)damage=Math.round(damage*Isekai.attackMult(p,s.range>3));if(target){const dx=target.x-p.x,dy=target.y-p.y;p.dir=Math.abs(dx)>Math.abs(dy)?dx>0?2:1:dy>0?0:3;}event(w,s.range>3?'projectile':'slash',p.x,p.y,p.dir,critical?'#f9c96b':'#f8e1a1',p.id);Object.assign(w.events[w.events.length-1],{classId:p.classId});if(target){Object.assign(w.events[w.events.length-1],{targetX:target.x,targetY:target.y});hitMonster(w,p,target,damage);if(Isekai)Isekai.train(w,p,s.range>3?'pontaria':'combate',1);if(p.classId==='necromante')p.hp=Math.min(s.hp,p.hp+3);}}
  const quests=[
    {title:'Um lugar para começar',body:'Íria espera perto do poço. Converse com ela para entender por que as estradas estão mudando.',goal:'Converse com Íria na praça.',check:p=>true},
    {title:'O que a terra oferece',body:'“Antes de procurar respostas, aprenda a voltar inteiro.” Colete recursos fora da vila. Árvores, rochas e ervas respondem à sua ferramenta.',goal:'Colete 5 vezes e volte para Íria.',check:p=>p.gathered>=5},
    {title:'Pequenas coisas, dentes afiados',body:'Os limos se aproximaram das estradas. Íria precisa saber se a velha trilha ainda é segura.',goal:'Derrote 3 monstros e volte para Íria.',check:p=>p.kills>=3},
    {title:'Feito pelas próprias mãos',body:'Bento deixa a forja acesa para quem aprende. Uma arma nova pode ser a diferença entre voltar e virar uma história.',goal:'Fabrique 1 item e volte para Íria.',check:p=>p.crafted>=1},
    {title:'As pedras que recordam',body:'Há altares além do vale. Em cada um, uma memória pede uma decisão. Nem o fracasso deixa a estrada igual.',goal:'Resolva 2 encontros em santuários.',check:p=>p.shrineDone.length>=2},
    {title:'O nome que faltava',body:'No extremo norte, o Último Esquecido guarda o Jardim das Estrelas. Leve equipamento, poções e companhia.',goal:'Derrote o chefe e volte para Íria.',check:p=>p.bossKilled},
    {title:'Uma estrada sua',body:'O vale está em paz, por enquanto. Íria desenha seu sobrenome no mapa. Ainda há receitas, lugares e histórias esperando.',goal:'Explore, construa e escreva sua próxima história.',check:()=>false}
  ];
  function activity(w,p,kind,duration,extra={}){p.activity={kind,start:w.time,until:w.time+duration,...extra};}
  // A pact with Patrasche, Fenrir or a qilin also makes it a mount.
  function unlockMount(w,p){const c=p.isekai?.companions?.at(-1);if(!c||!['patrasche','fenrir','qilin'].includes(c.kind))return;const s=Progress.ensure(p);s.mounts||=[];if(!s.mounts.includes(c.kind)){s.mounts.push(c.kind);notify(w,p,monsterTypes[c.kind].name+' aceita ser sua montaria! Troque no painel Vida no vale e monte com H.');}}
  // Sleeping in a bed after dusk skips to 06:30 (only when nobody else is online, so shared clocks never jump).
  function sleepUntilMorning(w,p){const hour=(6+w.time/20)%24,others=Object.values(w.players).filter(q=>q.id!==p.id&&q.online!==false).length;if(!(hour>=18.5||hour<5.5)||others)return false;
    const skip=((6.5-hour+24)%24)*20;w.time+=skip;w.day=1+Math.floor(w.time/480);activity(w,p,'sleep',3);notify(w,p,'Você dormiu até o amanhecer. Vida e mana restauradas.');return true;}
  function enterTavern(w,p,d){const s=Palace.start(d);p.x=s.x;p.y=s.y;p.input={x:0,y:0,until:0};p.dir=3;notify(w,p,d.name+': o taverneiro serve ensopado no balcão e o bardo toca no palco.');}
  const rumors=['Dizem que um Fenrir acorrentado ronda a taiga. Quem o domar ganha a montaria mais rápida do vale.','À noite, bandidos esperam viajantes nas estradas. Ande em grupo ou leve poções.','Uma fênix foi vista sobre as montanhas. Enfraqueça-a até um terço da vida para firmar o pacto.','A capela do palácio restaura qualquer viajante. É só pedir com respeito.','Cavalos selvagens pastam nos campos e aceitam trigo de quem tem paciência.','O Sistema dá um ponto de atributo a quem completa o treino do dia.','Na Caverna dos Cristais há uma descida para as minas goblins.','A Cidadela do Totem guarda quatro chefes. Quebre os totens de cada ala primeiro.'];
  function palaceDoor(w,p){if(!Palace)return;const b=buildingAt(p.x,p.y);
    if(b?.kind==='palace'){const d=palaceOf(b.kingdom),s=Palace.start(d);p.x=s.x;p.y=s.y;p.input={x:0,y:0,until:0};p.dir=3;notify(w,p,d.name+': Grande Vestíbulo. A sala do trono fica ao norte.');return;}
    const tav=!dungeonAt(p.x,p.y)&&p.input?.until>w.time&&p.input.y<-.3&&tavernNear(p.x,p.y);if(tav){enterTavern(w,p,tav);return;}
    const d=dungeonAt(p.x,p.y);if(d?.kind==='tavern'&&tileAt(p.x,p.y,w.seed).exit){p.x=d.door.x;p.y=d.door.y+.8;p.input={x:0,y:0,until:0};p.dir=0;notify(w,p,'Você saiu da taverna.');return;}
    if(d?.kind==='palace'&&tileAt(p.x,p.y,w.seed).exit){const pb=buildings.find(z=>z.kind==='palace'&&z.kingdom===d.kingdom);p.x=pb.x+pb.w/2;p.y=pb.y+pb.h+1.4;p.input={x:0,y:0,until:0};p.dir=0;notify(w,p,'Você saiu do palácio.');}}
  function interact(w,p,rng){
    if(Isekai&&Isekai.tameable(w,p)){if(Isekai.tame(w,p))unlockMount(w,p);return;}
    const grave=w.graves.find(g=>g.owner===p.id&&Math.hypot(g.x-p.x,g.y-p.y)<2);if(grave){p.gold+=grave.gold;w.graves.splice(w.graves.indexOf(grave),1);notify(w,p,'Você recuperou as moedas da sua lápide.');return;}
    const room=buildingAt(p.x,p.y);
    const tavDoor=!dungeonAt(p.x,p.y)&&tavernNear(p.x,p.y);if(tavDoor){enterTavern(w,p,tavDoor);return;}
    const tavern=dungeonAt(p.x,p.y);if(tavern?.kind==='tavern'){const bar=Palace.bar(tavern),stage=Palace.stage(tavern);
      if(Math.hypot(p.x-bar.x,p.y-bar.y)<3.2){if(p.gold<5){notify(w,p,'O ensopado custa 5 moedas.');return;}p.gold-=5;const s=stats(p);p.hp=s.hp;p.mana=s.mana;activity(w,p,'cook',1.2);notify(w,p,'Ensopado quente (−5 moedas): vida e mana restauradas. O taverneiro cochicha: '+rumors[Math.floor((w.time/7+p.kills)%rumors.length)]);return;}
      if(Math.hypot(p.x-stage.x,p.y-stage.y)<3.5){p.buffs.haste=w.time+60;notify(w,p,'A canção do bardo anima seus passos: mais velocidade por 60 segundos.');return;}
      notify(w,p,'Salão da Taverna. Ensopado no balcão · música no palco.');return;}
    const castle=dungeonAt(p.x,p.y);if(castle?.kind==='palace'){const k=kingdoms.find(k=>k.id===castle.kingdom),t=Palace.thronePos(castle),where=Palace.roomAt(castle,p.x,p.y)?.id;
      if(Math.hypot(p.x-t.x,p.y-t.y)<6){royalAudience(w,p,k);return;}
      if(where==='chapel'){const s=stats(p);p.hp=s.hp;p.mana=s.mana;notify(w,p,'A Capela da Coroa renova suas forças. Vida e mana restauradas.');return;}
      if(where==='chambers'){const s=stats(p);p.hp=s.hp;p.mana=s.mana;p.buffs={};activity(w,p,'sleep',2);if(sleepUntilMorning(w,p))return;notify(w,p,'Você descansa nos aposentos reais. Vida e mana restauradas.');return;}
      notify(w,p,Palace.roomAt(castle,p.x,p.y)?.name||'Palácio');return;}
    const wildFriend=!room&&Progress.tameable?.(w,p);if(wildFriend&&!npcNear(w,p)){Progress.action({notify,give,items,kingdoms,kingdomAt,npcNear,tileAt,dungeonAt,gainXP},w,p,{type:'tameAnimal',id:wildFriend.id});return;}
    if(room){
      if(room.kind==='palace'){royalAudience(w,p,kingdoms.find(k=>k.id===room.kingdom));return;}
      if(room.kind==='forge'){p.dialog={kind:'forge'};return;}
      if(room.kind==='guild'){guildDialog(p);return;}
      const s=stats(p);p.hp=s.hp;p.mana=s.mana;p.buffs={};activity(w,p,'sleep',2);
      if(sleepUntilMorning(w,p))return;
      notify(w,p,room.kind==='inn'?'Você descansou na pousada. Vida e mana restauradas.':'Você descansa junto à lareira. Vida e mana restauradas.');return;
    }
    const door=doorNear(p.x,p.y);
    if(door){p.x=door.x+door.w/2;p.y=door.y+door.h-.8;p.input={x:0,y:0,until:0};notify(w,p,'Você entrou: '+(door.name||'Casa do vale')+'. Para sair, caminhe pela porta.');return;}
    const npc=npcNear(w,p);if(npc){if(npc.role==='merchant'){merchantDialog(w,p,npc);return;}p.dialog=npc.role==='quest'?{kind:'quest',title:quests[p.quest].title,text:quests[p.quest].body}:{kind:'result',title:npc.name,text:npc.text};return;}
    const l=landmarkAt(p.x,p.y,2.3);
    if(l){
      if(!p.visited.includes(l.id))p.visited.push(l.id);
      if(l.kind==='kingdom'){royalAudience(w,p,kingdoms.find(k=>k.id===l.id));return;}
      if(l.kind==='guild'){guildDialog(p);return;}
      if(l.kind==='seat'){const h=houseById[l.house],own=familyOf(p).id===h.id;if(own&&h.noble){const s=stats(p);p.hp=s.hp;p.mana=s.mana;}p.dialog={kind:'family',house:h.id,title:h.seat.name,text:h.lore,own,claimed:!!p.heirloom};return;}
      if(l.kind==='citadel'){p.x=citadel.rx+9.5;p.y=citadel.ry+27.5;p.input={x:0,y:0,until:0};spawnCitadel(w);notify(w,p,'Cidadela do Totem: quebre o totem de cada ala para derrubar o escudo do chefe. Quatro chefes abrem o selo do Grande Totem. O portal atrás de você leva de volta.');return;}
      if(l.kind==='deep'){p.x=abyss.rx+abyss.w/2+.5;p.y=abyss.ry+abyss.h-3+.5;p.input={x:0,y:0,until:0};spawnAbyss(w);notify(w,p,'Abismo de Véspera: três guardiões vigiam seus covis. Derrote-os para romper o selo de Ignarok. O portal atrás de você leva de volta.');return;}
      if(l.kind==='lair'){p.x=lairExp.rx+Lair.entry.x;p.y=lairExp.ry+Lair.entry.y-3;p.input={x:0,y:0,until:0};spawnLair(w);notify(w,p,'Covil dos Goblins: Murk e Grol guardam o portão de guerra. Derrote os dois para enfrentar o Rei Gorzak. A saída fica logo atrás de você.');return;}
      if(l.kind==='camp'){const alive=Object.values(w.monsters).filter(m=>m.camp===l.camp&&m.hp>0).length;if(alive){notify(w,p,'Ainda há '+alive+' goblin'+(alive>1?'s':'')+' guardando o baú do acampamento.');return;}p.campLoot||={};if(p.campLoot[l.camp]>w.time){notify(w,p,'Baú vazio. Os goblins voltam a enchê-lo em '+Math.ceil((p.campLoot[l.camp]-w.time)/60)+' min.');return;}
        const c=Frontier.camps.find(c=>c.id===l.camp),r=c?.ring||0,gold=40+r*35;p.campLoot[l.camp]=w.time+600;p.gold+=gold;give(p,'potion',1+(r>1?1:0));give(p,'ore'+Math.min(12,3+r*3),2+r);gainXP(w,p,30+r*25);notify(w,p,'Baú goblin: +'+gold+' moedas · '+(2+r)+' '+items['ore'+Math.min(12,3+r*3)].name.toLowerCase()+' · poção');return;}
      if(l.kind==='hoard'&&l.goblin){const boss=w.monsters['lair:boss:throne'];if(boss&&boss.hp>0){notify(w,p,'Gorzak ainda está sentado no tesouro.');return;}p.hoards||=[];if(p.hoards.includes(l.id)){notify(w,p,'Você já levou sua parte do tesouro de Gorzak.');return;}p.hoards.push(l.id);p.gold+=260;give(p,'ore9',5);give(p,'essence',6);give(p,'potion',4);gainXP(w,p,150);notify(w,p,'Tesouro de Gorzak! +260 moedas · 5 ametistas · 6 essências · 4 poções');return;}
      if(l.kind==='hoard'){const boss=w.monsters['abyss:boss:'+l.area];if(boss&&boss.hp>0){notify(w,p,monsterTypes[l.lair].name+' ainda guarda este tesouro.');return;}p.hoards||=[];if(p.hoards.includes(l.id)){notify(w,p,'Você já levou sua parte deste tesouro.');return;}p.hoards.push(l.id);const big=l.lair==='wyrm';p.gold+=big?400:160;give(p,'ore'+(big?15:12),big?8:4);give(p,'essence',big?10:5);give(p,'potion',big?5:3);gainXP(w,p,big?200:90);notify(w,p,big?'O tesouro de Ignarok! +400 moedas · 8 estelitas · 10 essências · 5 poções':'Tesouro do covil: +160 moedas · 4 mithrils · 5 essências · 3 poções');return;}
      if(l.kind==='exit'){const d=expeditions.find(d=>d.id===l.expedition);p.x=d.x+.5;p.y=d.y+(d.kind==='lair'?2.8:.5);p.input={x:0,y:0,until:0};notify(w,p,'Você voltou à superfície.');return;}
      if(l.kind==='cave'||l.kind==='raid'){
        const d=expeditions.find(d=>d.id===l.id);w.raids||={};const r=w.raids[d.id];
        if(d.kind==='raid'&&!r?.active&&r?.readyAt>w.time){notify(w,p,`A entrada reabre em ${Math.ceil(r.readyAt-w.time)}s.`);return;}
        p.x=d.rx+d.w/2+.5;p.y=d.ry+d.h-3+.5;p.input={x:0,y:0,until:0};
        if(d.kind==='raid'){if(!r?.active){const teamSize=Object.values(w.players).filter(q=>!q.dead&&q.online!==false&&Math.hypot(q.x-d.x,q.y-d.y)<8).length+1;const state=w.raids[d.id]={active:true,wave:1,members:[p.id],scale:1+.5*(teamSize-1)};wave(w,d,state);}else if(!r.members.includes(p.id))r.members.push(p.id);}
        notify(w,p,d.kind==='cave'?'Caverna: aproxime-se dos veios e pressione E para minerar. Saída atrás de você.':d.name+' · 3 ondas, chefe e recompensa. A saída permite recuar.');return;
      }
      if(l.kind==='npc'){notify(w,p,'Íria está caminhando perto da praça. Procure o marcador de missão.');return;}
      if(l.kind==='inn'||l.kind==='well'){const s=stats(p);p.hp=s.hp;p.mana=s.mana;p.buffs={};activity(w,p,'sleep',2);notify(w,p,'O vale cuida dos seus. Vida e mana restauradas.');return;}
      if(l.kind==='forge'){p.dialog={kind:'forge'};return;}
      if(l.kind==='farm'){if(p.cooldowns.farm>w.time){notify(w,p,'O trigo ainda está crescendo. Volte em um minuto.');return;}give(p,'wheat',3);give(p,'seed',1);activity(w,p,'harvest',1);p.cooldowns.farm=w.time+60;notify(w,p,'+3 trigo · +1 semente');return;}
      if(l.kind==='chest'){if(p.chestOpened){notify(w,p,'O baú está vazio. A estrada tem mais para oferecer.');return;}p.chestOpened=true;give(p,'potion',3);give(p,'ore0',5);give(p,'wood',8);notify(w,p,'Você encontrou 3 poções, 5 minérios de cobre e 8 madeiras.');return;}
      if(l.kind==='shrine'||l.kind==='boss'){if(p.shrineDone.includes(l.id)){notify(w,p,'Esta pedra já guarda a sua história.');return;}p.dialog={kind:'shrine',id:l.id,title:l.name,text:chooseStory(p,l)};return;}
    }
    if(p.cooldowns.gather>w.time)return;
    const nearby=[];for(let y=Math.floor(p.y)-2;y<=Math.floor(p.y)+2;y++)for(let x=Math.floor(p.x)-2;x<=Math.floor(p.x)+2;x++){const distance=Math.hypot(x+.5-p.x,y+.5-p.y);if(distance<2.5&&dungeonAt(x,y)===dungeonAt(p.x,p.y))nearby.push({x,y,distance,tile:tileAt(x,y,w.seed)});}
    nearby.sort((a,b)=>a.distance-b.distance);
    for(const n of nearby){const key=`${n.x},${n.y}`;if(w.harvested[key]>w.time)continue;const kind=n.tile.kind;if(!['tree','rock','herb','berry','water','mushroom'].includes(kind))continue;
      p.cooldowns.gather=w.time+.65;p.gathered++;activity(w,p,kind==='tree'?'chop':kind==='rock'?'mine':kind==='water'?'reel':'harvest',.65,{x:n.x+.5,y:n.y+.5});const dx=n.x+.5-p.x,dy=n.y+.5-p.y;p.dir=Math.abs(dx)>Math.abs(dy)?dx>0?2:1:dy>0?0:3;const bonus=p.classId==='artifice'?1:0;const id=kind==='tree'?'wood':kind==='rock'?'ore'+n.tile.ore:kind==='water'?'fish':kind==='mushroom'?'essence':kind;const amount=kind==='water'||kind==='mushroom'?1+(kind==='mushroom'?bonus:0):2+bonus;if(kind==='mushroom')give(p,'herb',1);give(p,id,amount);if(kind==='tree')give(p,'fiber',1);if(kind==='rock'){if(n.tile.underground)p.mined=(p.mined||0)+1;give(p,'stone',2);if(rng()>.6)give(p,'coal',1);}if(Isekai)Isekai.onGather(w,p,kind,id,n.tile);if(kind!=='water')w.harvested[key]=w.time+180;else p.cooldowns.gather=w.time+3;gainXP(w,p,familyOf(p).noble?3:n.tile.underground?7:5);event(w,'loot',n.x+.5,n.y+.5,`+${amount} ${items[id].name}`,'#e1ddae',p.id);return;
    }
    const camp=w.placed.find(o=>o.id==='campfire'&&Math.hypot(o.x-p.x,o.y-p.y)<3);if(camp){p.hp=Math.min(stats(p).hp,p.hp+25);notify(w,p,'O calor da fogueira recupera 25 de vida.');return;}
    notify(w,p,'Aproxime-se de uma pessoa, árvore, rocha, erva ou da água.');
  }
  function chooseStory(p,l){const texts=[`Uma mulher feita de folhas segura uma carta com o nome ${p.name} ${p.surname}. “Você pode ler. Mas uma lembrança sua ficará comigo.”`, 'A pedra está morna. De dentro dela vem o som de alguém batendo à porta. Não há porta deste lado.', 'Uma raposa branca guarda uma moeda sob a pata. Quando você chega perto, ela pergunta qual é o preço de uma promessa.', 'Seu reflexo na água não copia seus movimentos. Ele estende a mão e parece muito mais cansado do que você.', 'O vento carrega uma canção da sua infância. O problema é que você nunca a contou a ninguém neste lugar.', 'Entre as raízes, alguém enterrou uma bússola que aponta para você. A inscrição diz: “O caminho também escolhe.”'];return texts[landmarks.indexOf(l)%texts.length];}
  // ---------- Grimório: magias aprendidas com nível, moedas e materiais ----------
  const spells=[
    {id:'fagulha',name:'Fagulha Arcana',school:'Arcano',color:'#9fd8ff',icon:'✦',level:1,cost:{},mana:8,cd:1.4,kind:'bolt',power:[20,3],range:6.5,desc:'Um projétil de luz que persegue o inimigo mais próximo.'},
    {id:'cura',name:'Luz Curativa',school:'Luz',color:'#fff1a8',icon:'✚',level:2,cost:{gold:30,herb:2},mana:18,cd:8,kind:'heal',power:[40,6],radius:3.5,desc:'Cura você e os aliados ao seu redor.'},
    {id:'gelo',name:'Nova de Gelo',school:'Gelo',color:'#a8e4f4',icon:'❄',level:3,cost:{gold:60,essence:2},mana:20,cd:7,kind:'nova',power:[18,3],radius:2.8,duration:3,desc:'Uma explosão gelada ao seu redor. Inimigos atingidos ficam lentos.'},
    {id:'raio',name:'Corrente de Raios',school:'Tempestade',color:'#f3e36a',icon:'ϟ',level:4,cost:{gold:90,essence:3},mana:24,cd:6,kind:'chain',power:[26,3],range:6,targets:4,desc:'Um raio salta entre até quatro inimigos, perdendo força a cada salto.'},
    {id:'egide',name:'Égide Dourada',school:'Luz',color:'#f3c85a',icon:'⛨',level:5,cost:{gold:120,ore5:2},mana:22,cd:16,kind:'buff',buff:'aegis',duration:8,radius:0,desc:'Um escudo de luz reduz pela metade o dano recebido por 8 segundos.'},
    {id:'vento',name:'Passo do Vento',school:'Ar',color:'#bdf0d0',icon:'≋',level:6,cost:{gold:140,fiber:4},mana:16,cd:14,kind:'buff',buff:'haste',duration:7,radius:5,desc:'Você e os aliados próximos correm mais rápido por 7 segundos.'},
    {id:'totem',name:'Fúria Ancestral',school:'Totem',color:'#e8b04a',icon:'⌬',level:6,cost:{gold:100},trophy:'trofeu-totem',mana:30,cd:25,kind:'buff',buff:'rage',duration:10,radius:5,desc:'Presente do Grande Totem: você e os aliados próximos ganham força por 10 segundos.'},
    {id:'raizes',name:'Raízes Vivas',school:'Natureza',color:'#8fd06a',icon:'❦',level:7,cost:{gold:160,herb:5,wood:6},mana:26,cd:12,kind:'root',power:[12,2],radius:4.2,duration:3,desc:'Raízes prendem no lugar todos os inimigos ao redor por 3 segundos.'},
    {id:'pacto',name:'Pacto Sombrio',school:'Sombra',color:'#b58cff',icon:'☾',level:8,cost:{gold:220,essence:6},mana:28,cd:9,kind:'drain',power:[34,4],range:5.5,desc:'Drena a vida de um inimigo e cura você com metade do dano.'},
    {id:'meteoro',name:'Meteoro Estelar',school:'Estelar',color:'#ff9a4a',icon:'☄',level:10,cost:{gold:320,ore13:2,essence:5},mana:45,cd:20,kind:'meteor',power:[70,6],range:7,radius:3,desc:'Uma estrela cai sobre o inimigo e queima tudo ao redor.'}
  ];
  // Artes do Monarca: only the Monarca das Sombras learns these, and it learns nothing else.
  spells.push(
    {id:'adaga',classOnly:'monarca',name:'Adaga Mortal',school:'Sombra',color:'#9d7bff',icon:'⚔',level:1,cost:{},mana:10,cd:3,kind:'dash',power:[26,4],range:6,desc:'Some nas sombras e reaparece ao lado do inimigo mais próximo com um golpe duplo.'},
    {id:'troca',classOnly:'monarca',name:'Troca de Sombras',school:'Sombra',color:'#7a5cff',icon:'⇄',level:3,cost:{gold:60,essence:2},mana:16,cd:9,kind:'swap',power:[20,3],radius:2.2,desc:'Troca de lugar com o soldado das sombras mais distante e fere quem estiver ao redor.'},
    {id:'autoridade',classOnly:'monarca',name:'Autoridade do Governante',school:'Sombra',color:'#c9b8ff',icon:'✋',level:5,cost:{gold:120,essence:4},mana:22,cd:11,kind:'pull',power:[22,3],radius:5.5,duration:2,desc:'Uma força invisível puxa os inimigos até você, fere e deixa todos lentos.'},
    {id:'dominio',classOnly:'monarca',name:'Domínio do Monarca',school:'Sombra',color:'#5a2fd0',icon:'♛',level:7,cost:{gold:200,essence:6},mana:30,cd:22,kind:'command',duration:10,desc:'Seu exército de sombras causa 70% mais dano e anda mais rápido por 10 segundos.'},
    {id:'furtividade',classOnly:'monarca',name:'Furtividade',school:'Sombra',color:'#3a2a5a',icon:'◐',level:9,cost:{gold:260,essence:8},mana:24,cd:18,kind:'stealth',duration:5,desc:'Você vira sombra: fica intocável por 2 segundos, mais rápido e mais forte por 5 segundos.'}
  );
  const spellById=Object.fromEntries(spells.map(sp=>[sp.id,sp]));
  const spellsFor=p=>spells.filter(sp=>p?.classId==='monarca'?sp.classOnly==='monarca':!sp.classOnly);
  // Only spellcasting classes use the grimoire; the others fight with their class skill (Q).
  const magicClasses=new Set(['mago','clerigo','druida','paladino','necromante','bardo','monarca']);
  function usesMagic(p){return magicClasses.has(p?.classId);}
  function noMagic(p){if(!usesMagic(p))throw new Error((classById[p.classId]?.name||'Sua classe')+' não usa magia: lute com a habilidade de classe (Q).');}
  function spellbook(p){if(p.classId==='monarca'&&!p.spells?.known?.includes('adaga'))p.spells={known:['adaga'],slots:['adaga',null,null]};p.spells||={known:['fagulha'],slots:['fagulha',null,null]};if(!Array.isArray(p.spells.slots)||p.spells.slots.length!==3)p.spells.slots=[p.spells.known[0]||null,null,null];return p.spells;}
  function spellPower(p,sp){return Math.round((sp.power[0]+sp.power[1]*p.level+(p.attributes?.spirit||0)*2)*(Isekai?Isekai.spellMult(p):1));}
  function spellLock(p,sp){const book=spellbook(p),missing=[];if(book.known.includes(sp.id))return [];if(p.level<sp.level)missing.push('nível '+sp.level);if(sp.trophy&&!p.trophies?.includes(sp.trophy))missing.push(items[sp.trophy].name);
    for(const [id,n] of Object.entries(sp.cost))if(id==='gold'?p.gold<n:(p.inventory[id]||0)<n)missing.push(id==='gold'?n+' moedas':n+'× '+items[id].name);return missing;}
  function learnSpell(w,p,id){noMagic(p);const sp=spellById[id];if(!sp)throw new Error('Magia desconhecida.');const book=spellbook(p);if(book.known.includes(id))return;if(!spellsFor(p).includes(sp))throw new Error('Sua classe não aprende esta magia.');const missing=spellLock(p,sp);if(missing.length)throw new Error('Falta: '+missing.join(', ')+'.');
    for(const [item,n] of Object.entries(sp.cost)){if(item==='gold')p.gold-=n;else{p.inventory[item]-=n;if(p.inventory[item]<=0)delete p.inventory[item];}}
    book.known.push(id);const free=book.slots.indexOf(null);if(free>=0)book.slots[free]=id;event(w,'spell',p.x,p.y,'learn',sp.color,null);Object.assign(w.events[w.events.length-1],{spell:'learn',caster:p.id});notify(w,p,'Nova magia no grimório: '+sp.name+(free>=0?' · espaço '+(free+1):''));}
  function equipSpell(p,id,slot){const book=spellbook(p);if(!Number.isInteger(slot)||slot<0||slot>2)throw new Error('Espaço inválido.');if(id!==null&&!book.known.includes(id))throw new Error('Aprenda a magia primeiro.');
    const current=book.slots.indexOf(id);if(id!==null&&current>=0)book.slots[current]=book.slots[slot];book.slots[slot]=id;}
  function castSpell(w,p,slot,rng){noMagic(p);const book=spellbook(p),id=book.slots[slot];if(!id)throw new Error('Equipe uma magia neste espaço no grimório (G).');const sp=spellById[id];
    const key='spell:'+id;if(p.cooldowns[key]>w.time){notify(w,p,sp.name+' recarrega em '+Math.ceil(p.cooldowns[key]-w.time)+'s.');return;}if(p.mana<sp.mana){notify(w,p,'Mana insuficiente para '+sp.name+'.');return;}
    const enemies=r=>nearEnemies(w,p,r).filter(m=>clearShot(w,p,m)&&dungeonAt(m.x,m.y)===dungeonAt(p.x,p.y));const allies=r=>Object.values(w.players).filter(q=>!q.dead&&q.online!==false&&Math.hypot(q.x-p.x,q.y-p.y)<=r);
    const rain=!dungeonAt(p.x,p.y)&&['rain','storm'].includes(Life.climate(w,biomeAt(p.x,p.y)).kind),power=sp.power?Math.round(spellPower(p,sp)*(rain&&sp.id==='raio'?1.35:rain&&sp.id==='meteoro'?.8:1)):0,hits=[];let target=null;
    if(sp.kind==='swap'&&!p.shadows?.length){notify(w,p,'Você precisa de soldados das sombras para trocar de lugar.');return;}
    if(['bolt','chain','drain','meteor','dash'].includes(sp.kind)){target=enemies(sp.range)[0];if(!target){notify(w,p,'Nenhum inimigo ao alcance de '+sp.name+'.');return;}const dx=target.x-p.x,dy=target.y-p.y;p.dir=Math.abs(dx)>Math.abs(dy)?dx>0?2:1:dy>0?0:3;}
    const crit=()=>rng()<stats(p).crit?1.6:1;
    if(sp.kind==='bolt'){hits.push({x:target.x,y:target.y});hitMonster(w,p,target,Math.round(power*crit()));}
    if(sp.kind==='chain'){let from=target,damage=power;const done=new Set();for(let i=0;i<sp.targets&&from;i++){done.add(from.id);hits.push({x:from.x,y:from.y});hitMonster(w,p,from,Math.round(damage*crit()));damage*=.85;const prev=from;from=Object.values(w.monsters).filter(m=>m.hp>0&&!done.has(m.id)&&Math.hypot(m.x-prev.x,m.y-prev.y)<3.6&&dungeonAt(m.x,m.y)===dungeonAt(p.x,p.y)).sort((a,b)=>Math.hypot(a.x-prev.x,a.y-prev.y)-Math.hypot(b.x-prev.x,b.y-prev.y))[0];}}
    if(sp.kind==='drain'){const dealt=Math.min(target.hp,power);hits.push({x:target.x,y:target.y});hitMonster(w,p,target,power);p.hp=Math.min(stats(p).hp,p.hp+Math.round(dealt/2));}
    if(sp.kind==='meteor'){const cx=target.x,cy=target.y;hits.push({x:cx,y:cy});for(const m of Object.values(w.monsters))if(m.hp>0&&Math.hypot(m.x-cx,m.y-cy)<=sp.radius&&dungeonAt(m.x,m.y)===dungeonAt(p.x,p.y))hitMonster(w,p,m,Math.round(power*(m===target?1:.7)));}
    if(sp.kind==='nova')for(const m of enemies(sp.radius)){hits.push({x:m.x,y:m.y});hitMonster(w,p,m,power);m.slowUntil=Math.max(m.slowUntil||0,w.time+sp.duration*.5);}
    if(sp.kind==='root')for(const m of enemies(sp.radius)){hits.push({x:m.x,y:m.y});hitMonster(w,p,m,power);m.slowUntil=Math.max(m.slowUntil||0,w.time+sp.duration);}
    if(sp.kind==='heal')for(const q of allies(sp.radius)){const s=stats(q);q.hp=Math.min(s.hp,q.hp+power);hits.push({x:q.x,y:q.y});}
    if(sp.kind==='dash'){const d=Math.hypot(target.x-p.x,target.y-p.y)||1,nx=target.x-(target.x-p.x)/d*.9,ny=target.y-(target.y-p.y)/d*.9;hits.push({x:p.x,y:p.y});if(walkable(w,nx,ny)){p.x=nx;p.y=ny;}hitMonster(w,p,target,Math.round(power*crit()));hits.push({x:target.x,y:target.y});if(target.hp>0)hitMonster(w,p,target,Math.round(power*.5*crit()));}
    if(sp.kind==='swap'){const far=p.shadows.reduce((a,c)=>Math.hypot(c.x-p.x,c.y-p.y)>Math.hypot(a.x-p.x,a.y-p.y)?c:a);hits.push({x:p.x,y:p.y});[p.x,p.y,far.x,far.y]=[far.x,far.y,p.x,p.y];hits.push({x:p.x,y:p.y});for(const m of enemies(sp.radius))hitMonster(w,p,m,power);p.buffs.invincible=Math.max(p.buffs.invincible||0,w.time+.6);}
    if(sp.kind==='pull')for(const m of enemies(sp.radius)){const d=Math.hypot(m.x-p.x,m.y-p.y)||1,k=Math.max(0,d-1.3)/d*(isBoss(m)?.35:1),nx=m.x-(m.x-p.x)*k,ny=m.y-(m.y-p.y)*k;if(walkable(w,nx,ny)){m.x=nx;m.y=ny;}hits.push({x:m.x,y:m.y});hitMonster(w,p,m,power);m.slowUntil=Math.max(m.slowUntil||0,w.time+sp.duration);}
    if(sp.kind==='command'){p.buffs.dominion=w.time+sp.duration;for(const c of p.shadows||[])hits.push({x:c.x,y:c.y});hits.push({x:p.x,y:p.y});}
    if(sp.kind==='stealth'){p.buffs.invincible=Math.max(p.buffs.invincible||0,w.time+2);p.buffs.haste=w.time+sp.duration;p.buffs.rage=w.time+sp.duration;hits.push({x:p.x,y:p.y});}
    if(sp.kind==='buff')for(const q of sp.radius?allies(sp.radius):[p]){q.buffs[sp.buff]=w.time+sp.duration;hits.push({x:q.x,y:q.y});}
    p.mana-=sp.mana;p.cooldowns[key]=w.time+sp.cd;p.attackAt=w.time;activity(w,p,'cast',.48);if(p.progress)p.progress.fishing=null;p.metrics||={};p.metrics.spellsCast=(p.metrics.spellsCast||0)+1;
    event(w,'spell',p.x,p.y,sp.id,sp.color,null);Object.assign(w.events[w.events.length-1],{spell:sp.id,caster:p.id,hits,radius:sp.radius||0});}
  function act(w,p,action,rng=Math.random){
    if(!p)throw new Error('Personagem não encontrado.');
    const type=action.type;
    if(type==='customize'){if(action.look==null){delete p.look;return;}const look=normalizeLook({...(p.look||{}),...action.look},p.classId,p.appearance);p.look=look;p.appearance=look.body==='man'?'male':'female';return;}
    if(type==='respawn'){if(!p.dead)return;p.dead=false;p.x=SPAWN.x;p.y=SPAWN.y;const s=stats(p);p.hp=s.hp;p.mana=s.mana;p.buffs={invincible:w.time+5};p.dialog=null;notify(w,p,'Você despertou na vila. Sua lápide guarda parte das moedas.');return;}
    if(p.dead)return;
    if(type==='arenaStart'){if(w.arena&&!w.arena.finished){Arena.join(w.arena,p.id,action.hero);const u=Arena.heroFor(w.arena,p.id);u.bot=false;}else {w.arena=Arena.create({hero:action.hero,owner:p.id,size:action.size,seed:w.seed+((w.arenaSerial||0)+1)*7919,difficulty:action.difficulty});w.arena.id=w.seed+'-'+(++w.arenaSerial|| (w.arenaSerial=1));}p.arenaActive=true;p.input={x:0,y:0,until:0};return;}
    if(type==='arenaLeave'){p.arenaActive=false;const u=w.arena&&Arena.heroFor(w.arena,p.id);if(u){u.bot=true;u.input={x:0,y:0,until:0};}return;}
    if(type==='arenaCommand'){if(!p.arenaActive)return;Arena.command(w.arena,p.id,action.command||{});return;}
    if(type==='arenaInput'){if(p.arenaActive)Arena.command(w.arena,p.id,{type:'input',x:action.x,y:action.y,ax:action.ax,ay:action.ay});return;}
    if(p.arenaActive)throw new Error('Volte ao vale para usar esta ação.');
    Life.ensure(w);if(Progress.action({notify,give,items,kingdoms,kingdomAt,npcNear,tileAt,dungeonAt,gainXP},w,p,action))return;
    if(type==='appearance'){if(!['female','male'].includes(action.value))throw new Error('Aparência inválida.');p.appearance=action.value;if(p.look){p.look={...p.look,body:action.value==='male'?'man':'woman'};if(action.value==='female')p.look.beard='none';}return;}
    if(type==='close'){p.dialog=null;return;}
    if(Trade&&type==='guildSell'){Trade.sell(w,p,String(action.id),action.all?9999:Number(action.n)||1);return;}
    if(Guild&&type==='questAccept'){Guild.accept(w,p,String(action.id));return;}
    if(Guild&&type==='questAbandon'){Guild.abandon(w,p,String(action.id));return;}
    if(Guild&&type==='questTurnIn'){Guild.turnIn(w,p,String(action.id));return;}
    if(Guild&&type==='letterRead'){Guild.readLetter(w,p,String(action.id));return;}
    if(Isekai&&type==='isekaiChoose'){Isekai.choose(w,p,String(action.race),String(action.unique));return;}
    if(Isekai&&type==='tame'){if(Isekai.tame(w,p))unlockMount(w,p);return;}
    if(Isekai&&type==='nameCompanion'){Isekai.nameCompanion(w,p,action.index,action.name);return;}
    if(Isekai&&type==='releaseCompanion'){Isekai.release(w,p,action.index);return;}
    if(Isekai&&type==='equipTitle'){Isekai.equipTitle(p,action.id===null?null:String(action.id));return;}
    if(type==='die'){die(w,p);return;}
    if(type==='attack'){attack(w,p,rng,action.targetId);return;}
    if(type==='learnSpell'){learnSpell(w,p,String(action.id));return;}
    if(type==='equipSpell'){equipSpell(p,action.id===null?null:String(action.id),Number(action.slot));return;}
    if(type==='cast'){if(p.dialog)return;const manaBefore=p.mana;castSpell(w,p,Number(action.slot),rng);if(Isekai&&p.mana<manaBefore){const sp=spellById[spellbook(p).slots[Number(action.slot)]];event(w,'circle',p.x,p.y,'',sp?.color||'#bfe8ff');Isekai.train(w,p,'magia',2);}return;}
    if(type==='interact'){interact(w,p,rng);return;}
    if(type==='buy'){
      const n=npcsAt(w).find(n=>n.id===action.merchant&&n.role==='merchant');
      if(!n||Math.hypot(n.x-p.x,n.y-p.y)>=3||dungeonAt(p.x,p.y)||buildingAt(p.x,p.y))throw new Error('Aproxime-se do mercador para comprar.');
      const baseOffer=(n.goods||merchantGoods).find(g=>g.id===action.id),offer=baseOffer&&{...baseOffer,price:Progress.price(w,baseOffer)};if(!offer)throw new Error('Mercadoria indisponível.');
      if(p.gold<offer.price)throw new Error('Moedas insuficientes.');p.gold-=offer.price;give(p,offer.id);merchantDialog(w,p,n);notify(w,p,'Comprado: '+items[offer.id].name);return;
    }
    if(type==='guildJoin'||type==='guildClaim'){
      if(landmarkAt(p.x,p.y,2.3)?.kind!=='guild'&&buildingAt(p.x,p.y)?.kind!=='guild')throw new Error('Visite a guilda na praça.');
      if(!p.guild){if(type!=='guildJoin')throw new Error('Entre na guilda primeiro.');p.guild={reputation:0,contract:0,startKills:p.kills,startMined:p.mined||0};}
      else if(type==='guildClaim'){const g=p.guild,done=g.contract%2?p.kills-g.startKills>=5:(p.mined||0)-g.startMined>=8;if(!done){notify(w,p,'O contrato ainda não foi concluído.');guildDialog(p);return;}p.gold+=60;give(p,'potion',familyOf(p).noble?2:3);g.reputation+=20;g.contract++;g.startKills=p.kills;g.startMined=p.mined||0;gainXP(w,p,40);notify(w,p,'Contrato entregue! +60 moedas · +2 poções · +20 reputação');}
      guildDialog(p);return;
    }
    if(type==='heirloom'){const l=landmarkAt(p.x,p.y,2.3),h=familyOf(p);if(l?.kind!=='seat'||l.house!==h.id)throw new Error('Visite o solar da sua família.');if(p.heirloom){notify(w,p,'A herança da família já está com você.');return;}p.heirloom=true;
      if(h.noble){p.gold+=120;give(p,'broche-4');give(p,'potion',2);notify(w,p,'Herança de '+h.title+': +120 moedas · Broche de prata · +2 poções');}
      else{give(p,'wood',12);give(p,'stone',8);give(p,'ore4',6);give(p,'botas-4');give(p,'potion',4);notify(w,p,'Herança de '+h.title+': materiais, 6 minérios de prata, Botas de prata e +4 poções');}
      p.dialog={kind:'family',house:h.id,title:h.seat.name,text:h.lore,own:true,claimed:true};return;}
    if(type==='roll'){
      const sides=Number(action.sides);if(![4,6,8,10,12,20,100].includes(sides))throw new Error('Escolha um dado válido.');
      const attribute=action.attribute||null;if(attribute&&(!Object.hasOwn(attributeDefs,attribute)||sides!==20))throw new Error('Testes de atributo usam d20.');
      const value=1+Math.min(sides-1,Math.floor(Math.max(0,rng())*sides)),bonus=attribute?Math.floor((p.attributes?.[attribute]||0)/2):0;
      const result={sides,value,bonus,total:value+bonus,attribute,time:w.time,success:attribute?(value===20||value!==1&&value+bonus>=12):null};
      p.rolls=[result,...(p.rolls||[])].slice(0,12);event(w,'dice',p.x,p.y,'d'+sides+': '+result.total,'#f4d68a');return;
    }
    if(type==='attribute'){if(!Object.hasOwn(attributeDefs,action.id))throw new Error('Atributo inválido.');if(attributePoints(p)<1)throw new Error('Você não tem pontos disponíveis.');p.attributes||={};if((p.attributes[action.id]||0)>=20)throw new Error('Limite de 20 pontos neste atributo.');p.attributes[action.id]=(p.attributes[action.id]||0)+1;return;}
    if(type==='dodge'){if(p.cooldowns.dodge>w.time||p.mana<8)return;p.mana-=8;p.cooldowns.dodge=w.time+1.6;p.buffs.invincible=w.time+.5;p.buffs.dodge=w.time+.22;return;}
    if(type==='skill'){
      if(p.cooldowns.skill>w.time||p.mana<25){notify(w,p,'A habilidade precisa de 25 mana e de tempo para recarregar.');return;}
      const c=classById[p.classId];p.mana-=25;p.cooldowns.skill=w.time+8;event(w,'skill',p.x,p.y,c.skill,c.color,p.id);Object.assign(w.events[w.events.length-1],{classId:p.classId});
      if(c.id==='paladino')p.buffs.shield=w.time+4;
      if(c.id==='druida')for(const m of nearEnemies(w,p,4).filter(m=>clearShot(w,p,m)))m.slowUntil=w.time+3;
      if(c.id==='artifice')for(const ally of Object.values(w.players))if(!ally.dead&&Math.hypot(ally.x-p.x,ally.y-p.y)<4)ally.buffs.shield=w.time+5;
      if(c.id==='bardo')for(const ally of Object.values(w.players))if(!ally.dead&&Math.hypot(ally.x-p.x,ally.y-p.y)<6)ally.mana=Math.min(stats(ally).mana,ally.mana+10);
      if(c.id==='ladino')p.buffs.invincible=w.time+.8;
      if(c.id==='guerreiro')for(const m of nearEnemies(w,p,3).filter(m=>clearShot(w,p,m)))m.slowUntil=w.time+1.5;
      if(c.effect==='heal')for(const ally of Object.values(w.players)){if(!ally.dead&&Math.hypot(ally.x-p.x,ally.y-p.y)<6)ally.hp=Math.min(stats(ally).hp,ally.hp+45);}
      else if(c.effect==='shield')p.buffs.shield=w.time+7;
      else if(c.effect==='haste'){for(const ally of Object.values(w.players))if(Math.hypot(ally.x-p.x,ally.y-p.y)<6)ally.buffs.haste=w.time+8;}
      else if(c.effect==='rage'){p.hp=Math.max(1,p.hp-12);p.buffs.rage=w.time+8;}
      else if(c.effect==='arise')arise(w,p,rng);
      else {for(const m of nearEnemies(w,p,5).filter(m=>clearShot(w,p,m,usesMagic(p))))hitMonster(w,p,m,stats(p).atk*2);if(c.effect==='drain')p.hp=Math.min(stats(p).hp,p.hp+30);}
      // Support skills also strike: every class skill deals damage around the hero.
      const pulse={guardiao:[2.6,1.3],clerigo:[4,1.2],druida:[4,1.5],paladino:[3,1.5],bardo:[5,1.2],artifice:[4,1.3],berserker:[2.8,1.6]}[c.id];
      if(pulse)for(const m of nearEnemies(w,p,pulse[0]).filter(m=>clearShot(w,p,m,true)))hitMonster(w,p,m,Math.round(stats(p).atk*pulse[1]));
      if(c.id==='ladino'){const m=nearEnemies(w,p,3.5).find(m=>clearShot(w,p,m));if(m)hitMonster(w,p,m,Math.round(stats(p).atk*2.5));}
      return;
    }
    if(type==='equip'){const item=items[action.id];if(!item||item.type!=='equipment'||!p.inventory[item.id])throw new Error('Você não possui este equipamento.');const old=p.equipment[item.slot];if(old)give(p,old);consume(p,item.id);p.equipment[item.slot]=item.id;p.hp=Math.min(p.hp,stats(p).hp);notify(w,p,item.name+' equipado.');return;}
    if(type==='unequip'){if(!Object.hasOwn(p.equipment,action.slot))return;const old=p.equipment[action.slot];if(old){give(p,old);p.equipment[action.slot]=null;p.hp=Math.min(p.hp,stats(p).hp);}return;}
    if(type==='craft'){
      const recipe=recipes.find(r=>r.id===action.id);if(!recipe)throw new Error('Receita desconhecida.');
      if(recipe.station==='forge'&&buildingAt(p.x,p.y)?.kind!=='forge'&&Math.hypot(p.x-122.5,p.y-127.5)>4)throw new Error('Aproxime-se da forja de Bento para criar equipamentos.');
      for(const [id,n]of Object.entries(recipe.cost))if((p.inventory[id]||0)<n)throw new Error('Faltam ingredientes para esta receita.');
      for(const [id,n]of Object.entries(recipe.cost))consume(p,id,n);give(p,recipe.id);p.crafted++;activity(w,p,'craft',1.5);if(Isekai)Isekai.train(w,p,'criacao',2);gainXP(w,p,8);notify(w,p,'Criado: '+items[recipe.id].name);return;
    }
    if(type==='use'){
      const item=items[action.id];if(!item||!p.inventory[item.id])throw new Error('Item indisponível.');
      if(item.type==='building'){
        const dirs=[[0,1],[-1,0],[1,0],[0,-1]],d=dirs[p.dir]||dirs[0],x=Math.floor(p.x+d[0]*1.4)+.5,y=Math.floor(p.y+d[1]*1.4)+.5;
        if(!walkable(w,x,y)||landmarkAt(x,y,4)||w.placed.some(o=>Math.hypot(o.x-x,o.y-y)<1)||w.placed.length>=300)throw new Error('Escolha um terreno livre, longe das entradas e monumentos.');
        consume(p,item.id);w.placed.push({id:item.id,x,y,owner:p.id});notify(w,p,item.name+' colocado.');return;
      }
      if(item.id==='seed'){const tile=tileAt(p.x,p.y,w.seed);if(tile.kind!=='farm')throw new Error('Plante sementes na horta da vila.');if(p.cooldowns.plant>w.time)throw new Error('Espere a próxima colheita para plantar novamente.');consume(p,'seed');give(p,'wheat',2);p.cooldowns.plant=w.time+45;notify(w,p,'A horta rendeu 2 trigos. Novo plantio em 45 segundos.');return;}
      if(item.type!=='consumable')return;
      const s=stats(p);
      if(item.effect==='heal'&&p.hp>=s.hp)throw new Error('Sua vida já está completa. A poção foi preservada.');
      if(item.effect==='mana'&&p.mana>=s.mana)throw new Error('Sua mana já está completa. O tônico foi preservado.');
      consume(p,item.id);
      if(item.effect==='heal')p.hp=Math.min(s.hp,p.hp+item.power);
      if(item.effect==='mana')p.mana=Math.min(s.mana,p.mana+item.power);
      if(['haste','rage'].includes(item.effect))p.buffs[item.effect]=w.time+item.power;
      if(item.effect==='cleanse'){delete p.buffs.poison;delete p.buffs.slow;}
      if(item.effect==='bomb')for(const m of nearEnemies(w,p,4).filter(m=>clearShot(w,p,m)))hitMonster(w,p,m,item.power);
      event(w,'heal',p.x,p.y,item.name,'#bce2a3',p.id);return;
    }
    if(type==='quest'){
      if(!npcsAt(w).some(n=>n.id==='elder'&&Math.hypot(n.x-p.x,n.y-p.y)<2.3))throw new Error('Converse com Íria na praça.');
      const q=quests[p.quest];if(!q.check(p)){notify(w,p,q.goal);return;}if(p.quest>=6)return;
      p.journal.push({title:q.title,text:q.body});p.quest++;p.gold+=25;give(p,'potion');gainXP(w,p,25);p.dialog={kind:'quest',title:quests[p.quest].title,text:quests[p.quest].body};notify(w,p,'Novo capítulo · +25 moedas · +1 poção');return;
    }
    if(type==='story'){
      const dialog=p.dialog;if(!dialog||dialog.kind!=='shrine'||p.shrineDone.includes(dialog.id))throw new Error('Encontro indisponível.');
      if(!['listen','force','leave'].includes(action.choice))throw new Error('Escolha inválida.');
      const die=1+Math.floor(rng()*6),success=die>4;p.shrineDone.push(dialog.id);let text;
      if(action.choice==='leave'){text='Você agradece ao silêncio e segue em frente. Nem toda pergunta precisa ser respondida.';give(p,'herb',3);}
      else if(success){text=action.choice==='listen'?'Você escuta até o fim. A memória encontra descanso, e deixa um presente em suas mãos.':'A pedra cede. Do outro lado, uma luz antiga reconhece sua coragem.';p.gold+=60;give(p,'essence',5);give(p,'ore'+Math.min(15,biomeAt(p.x,p.y)*2),4);gainXP(w,p,45);}
      else{text=action.choice==='listen'?'A lembrança pesa mais do que parecia. Você aprende algo, mas sai tremendo.':'O selo se fecha sobre seus dedos. A floresta não confunde força com permissão.';hurt(w,p,18);give(p,'essence',1);}
      p.journal.push({title:dialog.title,text});p.dialog=p.dead?null:{kind:'result',title:dialog.title,text,die:action.choice==='leave'?null:die,success};return;
    }
    throw new Error('Ação desconhecida.');
  }
  function setInput(w,p,x,y){x=Number.isFinite(x)?Math.max(-1,Math.min(1,x)):0;y=Number.isFinite(y)?Math.max(-1,Math.min(1,y)):0;const len=Math.hypot(x,y);if(len>1){x/=len;y/=len;}p.input={x,y,until:w.time+.65};if(len>.05)p.dir=Math.abs(x)>Math.abs(y)?x>0?2:1:y>0?0:3;}
  // Monarca das Sombras: "Ergam-se!" raises monsters it killed in the last 40 s (within 8 m) as shadow soldiers.
  const shadowCap=p=>Math.min(8,2+Math.floor(p.level/4));
  function arise(w,p,rng=Math.random){
    p.castAt=w.time;const here=dungeonAt(p.x,p.y),fallen=(p.fallen||[]).filter(f=>w.time-f.t<40&&Math.hypot(f.x-p.x,f.y-p.y)<8&&dungeonAt(f.x,f.y)===here);p.shadows||=[];
    if(!fallen.length){for(const m of nearEnemies(w,p,4).filter(m=>clearShot(w,p,m,true)))hitMonster(w,p,m,Math.round(stats(p).atk*1.8));notify(w,p,'Nenhum corpo por perto. As sombras golpeiam ao seu redor.');return;}
    let raised=0;
    for(const f of fallen){
      if(f.boss&&rng()>.55+p.level*.02){event(w,'hit',f.x,f.y,'RESISTIU','#b9a8ff',p.id);continue;}
      p.serialShadow=(p.serialShadow||0)+1;p.shadows.push({id:'s'+p.serialShadow,kind:f.kind,x:f.x,y:f.y,dir:0,cd:0,tier:f.tier,boss:f.boss});raised++;
      event(w,'arise',f.x,f.y,'ERGAM-SE!','#9d7bff');
    }
    p.fallen=p.fallen.filter(f=>!fallen.includes(f));
    while(p.shadows.length>shadowCap(p))p.shadows.shift();
    if(raised)notify(w,p,`${raised} sombra(s) se ergueram. Exército: ${p.shadows.length}/${shadowCap(p)}.`);
  }
  function shadowTick(w,dt,active){
    for(const p of active){if(!p.shadows?.length)continue;const here=dungeonAt(p.x,p.y),atk=stats(p).atk;
      p.shadows.forEach((c,i)=>{
        let target=null,td=6;for(const m of Object.values(w.monsters)){if(m.hp<=0||monsterTypes[m.kind]?.inert||dungeonAt(m.x,m.y)!==here)continue;const d=Math.hypot(m.x-p.x,m.y-p.y);if(d<td){td=d;target=m;}}
        const a=i*Math.PI*2/Math.max(3,p.shadows.length)+Math.PI/2,gx=target?target.x:p.x+Math.cos(a)*1.6,gy=target?target.y:p.y+Math.sin(a)*1.1+.4;
        if(Math.hypot(c.x-p.x,c.y-p.y)>12||dungeonAt(c.x,c.y)!==here){c.x=p.x+Math.cos(a);c.y=p.y+Math.sin(a)*.8;}
        const dx=gx-c.x,dy=gy-c.y,dist=Math.hypot(dx,dy),stop=target?1.1:.2;
        if(dist>stop){const step=Math.min(dist-stop,(target?3.8:4.6)*(p.buffs.dominion>w.time?1.4:1)*dt);c.x+=dx/dist*step;c.y+=dy/dist*step;if(Math.abs(dx)>.05||Math.abs(dy)>.05)c.dir=Math.abs(dx)>Math.abs(dy)?dx>0?2:1:dy>0?0:3;}
        if(target&&dist<=1.5&&w.time>=(c.cd||0)){c.cd=w.time+1.2;c.attackAt=w.time;hitMonster(w,p,target,Math.round((atk*(c.boss?.9:.45)+(c.tier||0)*2)*(p.buffs.dominion>w.time?1.7:1)));}
      });}
  }
  function spawnNear(w,p){
    if(dungeonAt(p.x,p.y)===abyss){spawnAbyss(w);return;}
    if(dungeonAt(p.x,p.y)===citadel){spawnCitadel(w);return;}
    if(lairExp&&dungeonAt(p.x,p.y)===lairExp){spawnLair(w);return;}
    const cave=dungeonAt(p.x,p.y);if(cave){if(cave.depth){for(let i=0;i<cave.depth+1;i++){const id=cave.id+':goblin:'+i;if(w.monsters[id])continue;const kind=i%3===2?'goblinShaman':'goblin',t=monsterTypes[kind],x=cave.rx+7+i*3,y=cave.ry+10.5;if(walkable(w,x,y))w.monsters[id]={id,kind,cave:cave.id,x,y,homeX:x,homeY:y,hp:t.hp+cave.tier*10,maxHp:t.hp+cave.tier*10,tier:cave.tier,attack:0,hurtAt:-5};}}return;}

    const cx=Math.floor(p.x/12),cy=Math.floor(p.y/12);
    for(let y=cy-1;y<=cy+1;y++)for(let x=cx-1;x<=cx+1;x++){
      const key=`${x},${y}`;if(w.spawned[key])continue;w.spawned[key]=true;
      for(let i=0;i<3;i++){const px=x*12+2+hash(x+i,y,w.seed)*8,py=y*12+2+hash(x,y+i+7,w.seed)*8;if(Math.hypot(px-128,py-128)<14||kingdomAt(px,py)||dungeonAt(px,py)||buildingAt(px,py)||!walkable(w,px,py))continue;const b=biomeAt(px,py),rare=i===0&&hash(x*7+3,y*5+1,w.seed)>.9,ring=Frontier&&!inHeart(px,py)?1+Frontier.ring(px,py):0;if(i>=monsterDensity(b)&&!(b===0&&rare))continue;const mystic=['qilin','kitsune','nekomata','salamander','phoenix','patrasche','cerberus','fenrir'][b],second=['brambleBoar','mossTurtle','moonMoth','glassScorpion','frostLynx','crystalStag','stormHawk',null][b],kind=rare&&mystic?(second&&hash(x+19,y+11,w.seed)>.5?second:mystic):mobFor(b,x,y,i,w.seed),t=monsterTypes[kind],id=key+':'+i;w.monsters[id]={id,kind,x:px,y:py,homeX:px,homeY:py,hp:t.hp+b*7+ring*28,maxHp:t.hp+b*7+ring*28,tier:b+ring*2,attack:0,hurtAt:-5};}
    }
    // Goblin camps: four to seven goblins around the fire, tougher the farther the camp is from the valley.
    if(Frontier&&!inHeart(p.x,p.y))for(const c of Frontier.campNear(p.x,p.y,34)){const n=4+c.ring,kinds=['goblin','goblinArcher','goblin','goblinShaman','goblinBrute','goblinArcher','goblinBrute'];
      for(let i=0;i<n;i++){const id=c.id+':'+i;if(w.monsters[id])continue;const kind=kinds[i],t=monsterTypes[kind],a=i*2.1,x=c.x+.5+Math.cos(a)*(3+i%2*2),y=c.y+.5+Math.sin(a)*(2.5+i%2*1.5);if(!walkable(w,x,y))continue;const tier=3+c.ring*2,hp=t.hp+tier*9;
        w.monsters[id]={id,kind,x,y,homeX:x,homeY:y,hp,maxHp:hp,tier,attack:0,hurtAt:-5,camp:c.id};}}
    spawnZones(w,p);
    const boss=landmarks.find(l=>l.kind==='boss');if(Math.hypot(p.x-boss.x,p.y-boss.y)<20&&!w.monsters.boss)w.monsters.boss={id:'boss',kind:'boss',x:boss.x+.5,y:boss.y-1.5,homeX:boss.x+.5,homeY:boss.y-1.5,hp:650,maxHp:650,tier:7,attack:0,hurtAt:-5};
  }
  // Hunting grounds: fixed areas of the valley where specific monsters always live (they respawn like any monster).
  const huntZones=[
    {id:'limos',name:'Charco dos Limos',sub:'Limos gordos que nunca param de pular.',x:93,y:144,r:5,tier:1,kinds:['slime','slime','slime','slime','slime']},
    {id:'cemiterio',name:'Cemitério das Sombras',sub:'Os mortos daqui ainda marcham em fila.',x:222,y:128,r:5,tier:3,kinds:['skeleton','skeleton','wraith','shade','soulWarden']},
    {id:'formigueiro',name:'Formigueiro Vermelho',sub:'A colônia protege um rei que nunca dorme.',x:145,y:190,r:6,tier:4,kinds:['antSoldier','antSoldier','antSoldier','antSoldier','antKing']},
    {id:'silfides',name:'Bosque das Sílfides',sub:'Risadas entre as folhas. Não confie nelas.',x:51,y:129,r:5,tier:5,kinds:['sylph','sylph','sylph','sylph']},
    {id:'gargulas',name:'Ninho das Gárgulas',sub:'Estátuas que viram a cabeça quando você passa.',x:72,y:165,r:5,tier:5,kinds:['gargoyle','gargoyle','dragonkin','dragonkin','bat']},
    {id:'naga',name:'Pântano da Naga',sub:'Escamas brilham debaixo da água parada.',x:216,y:190,r:5,tier:4,kinds:['naga','naga','lizardman','lizardman','lizardman']},
    {id:'orcs',name:'Acampamento Orc',sub:'Tambores de guerra ecoam entre os pinheiros.',x:183,y:60,r:6,tier:7,kinds:['orc','orc','orc','hellhound','hellhound','minotaur']},
    {id:'elfos',name:'Clareira dos Elfos de Gelo',sub:'Flechas de gelo vêm de lugar nenhum.',x:51,y:216,r:5,tier:6,kinds:['iceElf','iceElf','iceElf','ice']},
    {id:'fenda',name:'Fenda Infernal',sub:'Um portal vermelho rasgou o chão da savana.',x:24,y:48,r:6,tier:8,kinds:['demon','dragonkin','ember','gargoyle','hellhound']}
  ];
  const huntZoneAt=(x,y)=>inHeart(x,y)&&!dungeonAt(x,y)?huntZones.find(z=>Math.hypot(x-z.x,y-z.y)<z.r+3):null;
  function spawnZones(w,p){
    const zone=huntZoneAt(p.x,p.y);if((zone?.id||null)!==(p.huntZone||null)){p.huntZone=zone?.id||null;if(zone)notify(w,p,zone.name+' · '+zone.sub);}
    for(const z of huntZones){if(Math.hypot(p.x-z.x,p.y-z.y)>40)continue;
      z.kinds.forEach((kind,i)=>{const id='zone:'+z.id+':'+i;if(w.monsters[id])return;const t=monsterTypes[kind],boss=!!t.boss;
        for(let k=0;k<8;k++){const a=i*2.4+k*.9,rr=boss?k*.8:z.r*(.35+.12*((i+k)%5)),x=Math.floor(z.x+Math.cos(a)*rr)+.5,y=Math.floor(z.y+Math.sin(a)*rr)+.5;if(!walkable(w,x,y)||buildingAt(x,y))continue;
          const hp=boss?t.hp:t.hp+z.tier*12;w.monsters[id]={id,kind,x,y,homeX:x,homeY:y,hp,maxHp:hp,tier:z.tier,attack:0,hurtAt:-5,zone:z.id};break;}});}
  }
  // Night ambushes: up to two bandits near each traveller outside towns; they leave at dawn and never respawn.
  function banditTick(w,active){if(w.time<(w.banditCheck||0))return;w.banditCheck=w.time+4;const night=Life.night?Life.night(w):0;
    for(const [id,m] of Object.entries(w.monsters))if(m.kind==='bandit'&&(m.hp<=0||night<.15&&!active.some(p=>Math.hypot(p.x-m.x,p.y-m.y)<10)))delete w.monsters[id];
    if(night<.6)return;for(const p of active){if(dungeonAt(p.x,p.y)||kingdomAt(p.x,p.y)||Math.hypot(p.x-128,p.y-128)<20||buildingAt(p.x,p.y))continue;
      const near=Object.values(w.monsters).filter(m=>m.kind==='bandit'&&m.hp>0&&Math.hypot(m.x-p.x,m.y-p.y)<22).length;if(near>=2)continue;
      for(let k=0;k<8;k++){const a=hash(Math.floor(w.time),k,w.seed)*Math.PI*2,r=11+hash(k,Math.floor(w.time),w.seed)*4,x=p.x+Math.cos(a)*r,y=p.y+Math.sin(a)*r;
        if(!walkable(w,x,y)||dungeonAt(x,y)||kingdomAt(x,y)||buildingAt(x,y)||Math.hypot(x-128,y-128)<20)continue;w.banditSerial=(w.banditSerial||0)+1;const id='bandit:'+w.banditSerial,b=biomeAt(x,y);
        w.monsters[id]={id,kind:'bandit',x,y,homeX:x,homeY:y,hp:95+b*8,maxHp:95+b*8,tier:3+Math.floor(b/2),attack:0,hurtAt:-5,minion:true};notify(w,p,'Passos na escuridão... bandidos na estrada!');break;}}}
  function tick(w,dt,rng=Math.random){
    if(w.encounterRevision!==6){for(const [id,m] of Object.entries(w.monsters))if(m.raid)delete w.monsters[id];w.raids={};}
    if(w.encounterRevision!==6){for(const [id,m] of Object.entries(w.monsters)){if(m.raid||m.deep||m.citadel||m.cave||m.lair||m.camp||isBoss(m))continue;const index=Number(id.split(':')[1]);if(kingdomAt(m.x,m.y)||dungeonAt(m.x,m.y)||Number.isInteger(index)&&index>=monsterDensity(biomeAt(m.homeX,m.homeY)))delete w.monsters[id];}w.encounterRevision=6;}
    if(w.capitalRevision!==3){for(const [id,m] of Object.entries(w.monsters))if(!m.raid&&!m.deep&&!m.citadel&&!m.cave&&!m.lair&&!m.camp&&!isBoss(m)&&kingdomAt(m.x,m.y))delete w.monsters[id];w.capitalRevision=3;}
    dt=Math.min(.15,Math.max(0,dt));w.time+=dt;w.day=1+Math.floor(w.time/480);
    Life.tick({npcDefs,npcPosition,walkable,buildings,houses:houseList(),biomeAt,kingdomAt,dungeonAt},w);
    if(w.arena&&!w.arena.finished){for(const u of w.arena.units.filter(u=>u.owner)){const owner=w.players[u.owner];u.bot=!owner||owner.online===false||!owner.arenaActive;}Arena.tick(w.arena,dt);}
    const active=Object.values(w.players).filter(p=>p.online!==false&&!p.dead&&!p.arenaActive);if(Isekai)Isekai.tick(w,dt,active);shadowTick(w,dt,active);if(Guild)Guild.tick(w,active);if(Adventurers)Adventurers.tick(w,dt);
    for(const p of active){Progress.systemDay(w,p,notify);palaceDoor(w,p);}
    banditTick(w,active);
    for(const p of active)if(p.terrainRevision!==10||p.realmRevision!==1){
      if(!walkable(w,p.x,p.y)){
        let found=false;
        for(let radius=1;radius<=8&&!found;radius++)for(let dy=-radius;dy<=radius&&!found;dy++)for(let dx=-radius;dx<=radius;dx++){
          const x=Math.floor(p.x)+dx+.5,y=Math.floor(p.y)+dy+.5;
          if(walkable(w,x,y)&&walkable(w,x-.2,y)&&walkable(w,x+.2,y)&&!buildingAt(x,y)){p.x=x;p.y=y;found=true;break;}
        }
        if(!found){p.x=SPAWN.x;p.y=SPAWN.y;}
        p.input={x:0,y:0,until:0};
      }
      p.terrainRevision=10;p.realmRevision=1;
    }
    updateRaids(w);updateCitadel(w);
    for(const p of active){p.metrics||={};p.metrics.playTime=(p.metrics.playTime||0)+dt;const s=stats(p),input=p.input.until>w.time?p.input:{x:0,y:0};const speed=s.speed*(p.buffs.haste>w.time?1.4:1)*(p.buffs.slow>w.time?.6:1)*(p.buffs.penalty>w.time?.85:1)*(p.buffs.dodge>w.time?3:1);if(p.activity&&(p.activity.until<=w.time||input.x||input.y)){if(p.activity.kind==='fish'&&p.progress)p.progress.fishing=null;delete p.activity;}if(!p.dialog){const steps=Math.max(1,Math.ceil(speed*dt/.2));for(let step=0;step<steps;step++){const nx=p.x+input.x*speed*dt/steps,ny=p.y+input.y*speed*dt/steps;if(walkable(w,nx,p.y)&&walkable(w,nx-.18,p.y)&&walkable(w,nx+.18,p.y))p.x=nx;if(walkable(w,p.x,ny)&&walkable(w,p.x,ny-.15)&&walkable(w,p.x,ny+.15))p.y=ny;}}
      p.mana=Math.min(s.mana,p.mana+dt*3);if(p.classId==='druida')p.hp=Math.min(s.hp,p.hp+dt*.8);
      const chunk=`${Math.floor(p.x/8)},${Math.floor(p.y/8)}`;p.discovered[chunk]=true;
      if(p.buffs.poison>w.time&&(!p.cooldowns.poison||p.cooldowns.poison<w.time)){p.cooldowns.poison=w.time+1.5;hurt(w,p,5);}
      if(!p.cooldowns.spawn||p.cooldowns.spawn<w.time){p.cooldowns.spawn=w.time+1;spawnNear(w,p);}
    }
    for(const m of Object.values(w.monsters)){
      const close=active.filter(p=>!kingdomAt(p.x,p.y)&&dungeonAt(p.x,p.y)===dungeonAt(m.x,m.y)&&Math.hypot(m.x-p.x,m.y-p.y)<(m.raid?40:12));if(!close.length)continue;
      if(m.hp<=0){if(!m.raid&&w.time>m.respawn){if(m.minion){delete w.monsters[m.id];continue;}m.hp=m.maxHp;m.x=m.homeX;m.y=m.homeY;}continue;}
      if(monsterTypes[m.kind].inert)continue;
      const p=close.sort((a,b)=>Math.hypot(a.x-m.x,a.y-m.y)-Math.hypot(b.x-m.x,b.y-m.y))[0],distance=Math.hypot(p.x-m.x,p.y-m.y);
      if(distance<(m.raid?30:m.deep||m.citadel?(isBoss(m)?9:7):biomeAt(m.homeX,m.homeY)===0?2.5:7)&&!((m.deep||m.citadel)&&Math.hypot(m.x-m.homeX,m.y-m.homeY)>11)&&Math.hypot(p.x-128,p.y-128)>12){const spec=monsterTypes[m.kind];const ranged=['wisp','necromancer','ember'].includes(m.kind)||spec.ranged,pace=spec.speed*(m.enraged?1.35:1);if(!(m.slowUntil>w.time)&&distance>(ranged?3:1)){const nx=m.x+(p.x-m.x)/distance*pace*dt,ny=m.y+(p.y-m.y)/distance*pace*dt;if(walkable(w,nx,m.y))m.x=nx;if(walkable(w,m.x,ny))m.y=ny;}
        const reach=ranged?4:spec.boss?1.7:1.3;
        if(m.windup&&w.time>=m.windup){m.windup=0;m.attackAt=w.time;m.attack=w.time+(spec.boss?(m.enraged?1.6:2.4):1.5);if(distance<reach&&clearShot(w,m,p))hurt(w,p,spec.atk+m.tier*2+(m.enraged?4:0),spec.status||(m.kind==='wisp'?'poison':m.kind==='ice'?'slow':null));}
        else if(!m.windup&&distance<reach&&m.attack<w.time&&clearShot(w,m,p)){m.windup=w.time+(spec.boss?.9:.45);event(w,'warning',m.x,m.y,'!',spec.color);}

      }else if(Math.hypot(m.x-m.homeX,m.y-m.homeY)>1){m.x+=(m.homeX-m.x)*dt*.3;m.y+=(m.homeY-m.y)*dt*.3;}
    }
  }
  assignLooks();
  if(Isekai)Isekai.bind({event,notify,give,stats,hitMonster,dungeonAt,monsterTypes,isBoss,items});
  if(Trade)Trade.bind({give,consume,monsterTypes,landmarkAt,buildingAt,fullName,system:(w,p,t,k)=>Isekai?Isekai.system(w,p,t,k):notify(w,p,t),letter:(w,p,l)=>Guild?.letter?.(w,p,l)});
  if(Adventurers)Adventurers.bind({walkable,dungeonAt,monsterTypes,event,supply:(w,id,n)=>Trade?.supply(w,id,n),itemName:id=>items[id]?.name||id,hour:w=>Life.climate(w).hour,guildSpot:()=>({x:125.5,y:129.5}),innDoor:()=>({x:133.5,y:124}),tavernDoor:()=>({x:116,y:103.4})});
  if(Guild)Guild.bind({event,give,consume,gainXP,familyOf,fullName,items,landmarks,landmarkAt,buildingAt,kingdomAt,system:(w,p,t,k)=>Isekai?Isekai.system(w,p,t,k):notify(w,p,t),check:(w,p)=>Isekai?.check(w,p)});
  return {gates,huntZones,huntZoneAt,shadowCap,trade:Trade,adventurers:Adventurers,appearanceOptions,defaultLook,validLook,normalizeLook,WORLD,inHeart,frontier:Frontier,lair:Lair,lairExp,lairArea,lairInfo,spawnLair,palace:Palace,palaceOf,tavernNear,isekai:Isekai,guild:Guild,arenaRules:Arena,spells,spellById,spellsFor,usesMagic,spellbook,spellPower,spellLock,lookSignature,capitalStreet,capitalPlaza,citadel,citadelAreas,citadelWings,citadelArea,citadelInfo,spawnCitadel,merchantGoods,kingdomDecor,decorAt,kingdoms,kingdomAt,npcDefs,npcPosition,npcsAt,npcNear,attributeDefs,attributePoints,abyss,abyssAreas,abyssGuardians,abyssArea,abyssInfo,spawnAbyss,houses,houseById,playableHouses,familyOf,honorific,fullName,familyPerk,isBoss,bossLineage,raidPlans,expeditions,dungeonAt,monsterDensity,guildInfo,SIZE,TILE,SPAWN,classes,classById,biomes,materials,materialColors,items,recipes,landmarks,buildings,buildingAt,doorNear,monsterTypes,quests,hash,biomeAt,tileAt,landmarkAt,walkable,makeWorld,makePlayer,stats,equipmentChange,combatTarget,clearShot,validSave,act,tick,setInput,spawnNear,hurt,die,give};
});
