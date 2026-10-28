'use strict';
/* ============ constantes ============ */
var STATUS={
  separado:{l:'Separado',c:'neutral'},
  em_rota:{l:'Em rota',c:'accent'},
  entregue:{l:'Entregue',c:'good'},
  entregue_problema:{l:'Entregue com problema',c:'warn'},
  devolvido:{l:'Devolvido',c:'bad'},
  enviado_errado:{l:'Enviado errado',c:'mag'},
  cancelada:{l:'Cancelada',c:'neutral'}
};
var CONCL=['entregue','entregue_problema','devolvido','enviado_errado'];
var TIPOS_OC={defeito:'Produto com defeito',avaria:'Avaria no transporte',falta:'Item faltando',devolvido:'Devolvido',enviado_errado:'Enviado errado'};
var CATALOGO=[
  ['CX-100','Caixa organizadora 20 L'],['KT-210','Kit de instalação completo'],['MT-305','Motor monofásico 1/2 cv'],
  ['VL-412','Válvula esfera 3/4"'],['FT-520','Filtro de linha 8 tomadas'],['CB-618','Cabo flexível 2,5 mm (rolo 100 m)'],
  ['SN-702','Sensor indutivo M12'],['DJ-815','Disjuntor 20 A'],['BT-903','Bateria selada 12 V'],['LM-044','Luminária LED 18 W'],
  ['CT-131','Contator 25 A'],['RL-276','Relé de estado sólido 40 A']
];
var CLIENTES=[
  ['Mercantil Boa Vista','Rua das Palmeiras, 245 · Centro',240,140],['Farmácia Vida Nova','Av. Central, 1020 · Cidade Nova',480,140],
  ['Construtora Horizonte','Rua Quatro, 88 · Distrito Industrial',640,60],['Padaria Pão Dourado','Rua do Comércio, 17 · Flores',160,220],
  ['Escola Dom Bosco','Av. das Acácias, 560 · Aleixo',400,220],['Clínica Santa Luz','Rua Rio Branco, 310 · Adrianópolis',560,300],
  ['Supermercado Bom Preço','Av. Norte, 2300 · Parque 10',720,140],['Oficina Irmãos Reis','Rua Sete, 41 · Distrito Industrial',640,220],
  ['Hotel Rio Azul','Av. Beira Rio, 90 · Centro',320,380],['Restaurante Sabor da Terra','Rua Ipê, 155 · Dom Pedro',80,380],
  ['Papelaria Central','Rua Marechal, 12 · Centro',400,300],['Distribuidora Norte Sul','Av. Industrial, 780 · Distrito Industrial',720,60],
  ['Agropecuária Vale Verde','Estrada Velha, km 4 · Zona Rural',80,60],['Ótica Visão Clara','Rua Lima, 203 · Cidade Nova',480,380],
  ['Academia Corpo Ativo','Av. das Acácias, 1180 · Aleixo',560,140],['Casa & Cia Utilidades','Rua Cedro, 66 · Flores',240,300],
  ['Mecânica Rápida','Rua Oito, 12 · Distrito Industrial',640,300],['Condomínio Jardim das Águas','Rua Jacarandá, 300 · Parque 10',320,460]
];
var RECEB=['Ana Souza','Pedro Alves','Luciana Reis','Marcelo Dias','Fernanda Lopes','Ricardo Matos','Sônia Ribeiro','Tiago Barros'];
var MOT={
  defeito:['Produto não liga','Peça quebrada dentro da embalagem lacrada','Defeito de fábrica constatado pelo cliente'],
  avaria:['Caixa amassada no transporte','Item danificado na descarga','Embalagem molhada'],
  falta:['Faltou unidade na conferência','Volume não estava na carga','Quantidade menor que a da nota'],
  devolvido:['Cliente recusou: pedido duplicado','Estabelecimento fechado','Endereço não localizado','Sem responsável para receber'],
  enviado_errado:['Item diferente do pedido','Código trocado na separação','Quantidade acima do pedido']
};
/* frota de exemplo (modo local): placa, tipo, modelo, combustível, tanque (L), km inicial, meta km/L */
var VEICULOS_EX=[
  ['OAA1B23','moto','Honda CG 160','Gasolina',14,18200,35],['OAB2C34','moto','Honda CG 160','Gasolina',14,22750,35],
  ['OAC3D45','moto','Yamaha Fazer 250','Gasolina',20,9400,28],['OAD4E56','moto','Honda Biz 125','Gasolina',5,31200,45],
  ['PHA1A11','caminhao','VW Delivery 9.170','Diesel',100,142500,6],['PHB2B22','caminhao','Mercedes Accelo 815','Diesel',120,98300,5.5],
  ['PHC3C33','caminhao','Hyundai HR','Diesel',75,67800,9],
  ['QZA1D44','carro','Fiat Fiorino','Flex',48,54100,11],['QZB2E55','carro','Fiat Strada','Flex',55,38900,11.5],
  ['QZC3F66','carro','VW Saveiro','Flex',55,71200,11],['QZD4G77','carro','Renault Kangoo','Flex',50,45600,10],['QZE5H88','carro','Fiat Argo','Flex',48,12800,12.5]
];
var EQUIPE=[
  ['João Pereira','Efetivado','','Fiorino','QZB4C12','(92) 99111-2301','joao'],
  ['Marcos Silva','Efetivado','','Van Sprinter','PHL2E45','(92) 99122-4410','marcos'],
  ['Rafael Souza','Efetivado','','Saveiro','OAK7F90','(92) 99133-8802','rafael'],
  ['André Lima','Efetivado','','Strada','QZM1A33','(92) 99144-0567','andre'],
  ['Paulo Mendes','Efetivado','','VW Delivery','NAH5D78','(92) 99155-7714','paulo'],
  ['Diego Costa','Efetivado','','Renault Master','PHT9B21','(92) 99166-3098','diego'],
  ['Carlos Nogueira','Terceirizado','Transportes Rio Negro','Fiorino','JXC3H56','(92) 99177-5521','carlos'],
  ['Edson Barbosa','Terceirizado','Fretes Amazonas','HR Hyundai','OBD6G14','(92) 99188-6143','edson']
];
