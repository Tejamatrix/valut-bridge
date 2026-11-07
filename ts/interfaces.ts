interface User {
    name:string,
    age:number,
    grade:string
}

interface admin extends User{
    salary:number
}

const id:User={
    name:"teja",
    age:123,
    grade:"A"
}

const employee:admin={
  name:"teja",
    age:123,
    grade:"A",
    salary:1221
}


