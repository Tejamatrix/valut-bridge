from fastapi import FastAPI,Depends,Header,HTTPException
from pydantic import BaseModel
from pydantic import BaseModel
app = FastAPI()

def get_key(key:str = Header()):
    return key

def verify_key(key:str = Depends(get_key)):
    if key != "mysecretkey":
        raise HTTPException(status_code=401, detail="Invalid API Key")

@app.get("/items/")
def get_accessible_items(key: str = Depends(verify_key)):
    return {"message": "You have access to the items!"}