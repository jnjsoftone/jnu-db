"use strict";Object.defineProperty(exports,"__esModule",{value:!0}),Object.defineProperty(exports,"migrate",{enumerable:!0,get:function(){return n}});const e=require("./sqlite"),t=require("./postgres"),r=require("./mysql"),a=async(a,c)=>{switch(a.type){case"sqlite":{let t=await (0,e.executeQuery)(a.connection,`PRAGMA table_info(${c})`);return t.success?t.data.filter(e=>!e.pk&&"created_at"!==e.name).map(e=>e.name):[]}case"postgres":{let e=await (0,t.executeQuery)(a.connection,`SELECT column_name FROM information_schema.columns 
         WHERE table_name = $1 
         AND column_name != 'created_at' 
         AND column_default IS NULL OR column_default NOT LIKE 'nextval%'`,[c]);return e.success?e.data.map(e=>e.column_name):[]}case"mysql":{let e=await (0,r.executeQuery)(a.connection,`SHOW COLUMNS FROM ${c}`);return e.success?e.data.filter(e=>!e.Key.includes("PRI")&&"created_at"!==e.Field).map(e=>e.Field):[]}}},c=async(a,c,s,n,o)=>{let u=s.join(", "),i="postgres"===a.type?"LIMIT $1 OFFSET $2":"LIMIT ? OFFSET ?",l=[o,n];switch(a.type){case"sqlite":{let t=await (0,e.executeQuery)(a.connection,`SELECT ${u} FROM ${c} ${i}`,l);return t.success?t.data:[]}case"postgres":{let e=await (0,t.executeQuery)(a.connection,`SELECT ${u} FROM ${c} ${i}`,l);return e.success?e.data:[]}case"mysql":{let e=await (0,r.executeQuery)(a.connection,`SELECT ${u} FROM ${c} ${i}`,l);return e.success?e.data:[]}}},s=async(a,c,s,n)=>{if(0===n.length)return!0;try{for(let o of n){let n;let u=s.join(", "),i="postgres"===a.type?`(${s.map((e,t)=>`$${t+1}`).join(", ")})`:`(${s.map(()=>"?").join(", ")})`,l=`INSERT INTO ${c} (${u}) VALUES ${i}`,m=s.map(e=>o[e]);switch(a.type){case"sqlite":n=await (0,e.executeQuery)(a.connection,l,m);break;case"postgres":n=await (0,t.executeQuery)(a.connection,l,m);break;case"mysql":n=await (0,r.executeQuery)(a.connection,l,m)}if(!n.success)return console.error(`데이터 삽입 실패: ${JSON.stringify(n.error)}`),!1}return!0}catch(e){return console.error("데이터 삽입 중 오류:",e),!1}},n=async(e,t,r)=>{try{let n=await a(e,r);if(0===n.length)throw Error(`테이블 ${r}의 스키마를 가져올 수 없습니다.`);let o=await c(e,r,n,0,1e3);if(0===o.length)return{success:!0,tables:[{name:r,rows:0}]};if(!await s(t,r,n,o))throw Error(`테이블 ${r}의 데이터 삽입 중 오류가 발생했습니다.`);return{success:!0,tables:[{name:r,rows:o.length}],data:o}}catch(e){return{success:!1,error:e}}};