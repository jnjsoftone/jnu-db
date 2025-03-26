"use strict";Object.defineProperty(exports,"__esModule",{value:!0}),!function(e,r){for(var t in r)Object.defineProperty(e,t,{enumerable:!0,get:r[t]})}(exports,{backup:function(){return o},connect:function(){return a},createPool:function(){return t},disconnect:function(){return s},executeQuery:function(){return n},executeTransaction:function(){return c},restore:function(){return u}});const e=require("pg"),r=require("jnu-abc"),t=r=>new e.Pool({host:r.host,user:r.user,password:r.password,database:r.database,port:r.port||5432,max:r.max||20}),a=async e=>{try{let r=t(e);return await r.connect()}catch(e){return console.error("PostgreSQL 연결 오류:",e),null}},s=async e=>{try{await e.release()}catch(e){console.error("PostgreSQL 연결 해제 오류:",e)}},n=async(e,r,t=[])=>{try{let a=await e.query(r,t);return{success:!0,data:a.rows}}catch(e){return{success:!1,error:e instanceof Error?e.message:"알 수 없는 오류"}}},c=async(e,r)=>{try{let t=[];for(let{query:a,params:s=[]}of(await e.query("BEGIN"),r)){let r=await e.query(a,s);t.push(...r.rows)}return await e.query("COMMIT"),{success:!0,data:t}}catch(r){return await e.query("ROLLBACK"),{success:!1,error:r instanceof Error?r.message:"알 수 없는 오류"}}},o=async(e,t)=>{try{let a=await e.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `),s={};for(let{table_name:r}of a.rows){let t=await e.query(`SELECT * FROM ${r}`);s[r]=t.rows}return await (0,r.saveJson)(t,s),{success:!0}}catch(e){return{success:!1,error:e instanceof Error?e.message:"알 수 없는 오류"}}},u=async(e,t)=>{try{let a=await (0,r.loadJson)(t);for(let[r,t]of(await e.query("BEGIN"),Object.entries(a)))if(Array.isArray(t)&&t.length>0){let a=Object.keys(t[0]),s=a.map((e,r)=>`$${r+1}`).join(","),n=`INSERT INTO ${r} (${a.join(",")}) VALUES (${s})`;for(let r of t)await e.query(n,Object.values(r))}return await e.query("COMMIT"),{success:!0}}catch(r){return await e.query("ROLLBACK"),{success:!1,error:r instanceof Error?r.message:"알 수 없는 오류"}}};