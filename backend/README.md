# ⚙️ Estacionamiento Inteligente - Backend

Este es el directorio del **Backend** (API REST) para la aplicación de Estacionamiento Inteligente.

El servidor está desarrollado con:
- **Node.js**
- **Express v5** (Web framework rápido y minimalista)
- **PostgreSQL** (Motor de base de datos relacional)
- **jsonwebtoken (JWT)** (Autenticación y tokens de sesión)
- **bcrypt** (Encriptación y hashing seguro de contraseñas)
- **express-validator** (Validación e higienización de peticiones HTTP)

---

## 📖 Documentación General y Guía de Uso

Para obtener la información completa de la solución, incluyendo:
- 📊 **Esquema de Base de Datos y Diagrama ER (Mermaid)**
- 📁 **Estructura completa de directorios**
- 🛠️ **Configuración del Frontend (React + Three.js)**
- 🚀 **Instrucciones completas de instalación paso a paso**

Por favor, dirígete al **[README.md de la raíz del proyecto](../README.md)**.

---

## ⚙️ Configuración de Variables de Entorno

Debes crear un archivo llamado `.env` en este directorio con el siguiente formato:

```env
PORT=5000
JWT_SECRET=tu_secreto_super_seguro_para_jwt
DB_USER=tu_usuario_postgres
DB_HOST=localhost
DB_NAME=estacionamiento_inteligente
DB_PASSWORD=tu_contrasena_postgres
DB_PORT=5432
NODE_ENV=development
```

---

## ⚡ Comandos Rápidos

Para inicializar el servidor del backend:

```bash
# Instalar dependencias
npm install

# Iniciar servidor REST (disponible en http://localhost:5000)
npm start
```
