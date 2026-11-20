
from langchain_text_splitters import RecursiveCharacterTextSplitter
from sentence_transformers import SentenceTransformer
from faiss import FAISS
model = RecursiveCharacterTextSplitter(
    chunk_size = 50,
    chunk_overlap = 10
);

embedding_model = SentenceTransformer('all-MiniLM-L6-v2')   

vector_store = FAISS.from_texts(["This is a test document."], embedding_model)