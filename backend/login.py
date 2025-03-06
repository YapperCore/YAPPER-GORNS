import pyrebase 
import firebase_admin
from firebase_admin import credentials

cred = credentials.Certificate("C:/Users/egwai/Downloads/yapper-1958d-firebase-adminsdk-fbsvc-f128d7522c.json")
firebase_admin.initialize_app(cred, { 'storageBucket' : 'yapper-1958d.firebasestorage.app'})

firebase= pyrebase.initialize_app(cred)
auth = firebase.auth()

def login(email, password):
    pass

def signup():
    print ('SIGNUP')
    email = input('Enter email: ')
    password = input('Enter password: ')