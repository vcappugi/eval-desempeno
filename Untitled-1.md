
Instrucciones generales: crea un sistema de evaluacion, usando solo javascript y html, con conexion a base de datos supabase . 
crea el despliegue usando librerias pico.css (https://picocss.com) que sea responsive para ser visto en dispositivos moviles, tenga una barra lateral contraible y un header fijo, use las fuentes de letra de google fonts (https://fonts.google.com) y iconos de fontawesome (https://fontawesome.com). 
Que predomine el color verde y que añada como logo el archivo BEL_LOGO.jpg que esta en la carpeta images, use la conexion a base de datos supabase cuyas credenciales estan en el archivo .env, y tiene la siguiente estructura:


1. Crea un login con opcion a "recuerdame" usando los datos de usuario de la tabla "trabajador" donde tendra acceso a todas las opciones, solo si es rol "admin", si es usuario no vera el panes administrativo
1. Estas opciones deben estar bajo una opcion administrativo, en un item llamado "panel administrativo"
1.1. Tala de trabajadores: 
    Nombre: "trabajador" 
    Descripcion: tiene los datos de los trabajadores
    Nota: no incluir en la vista de lista el id, pero si incluir la fecha de creacion
    Instrucciones: Crea una funcionalidad que liste, agregue, modifique y elimine registros, con validacion del campo password llamado "clave" para que no se vea el texto
1.2. Tabla de competencias a evaluar:
    Nombre: "clase"
    Descripcion: Tiene los titulos de los aspectos generales a evaluar
    instrucciones: crea la funcionalidad para listar, agregar, modificar y eliminar registros, ordenados por el campo "orden". El listado muestroalo en formato tarjetas y no en listas
1.3. Tabla Aspectos de Evaluacion: 
    Nombre: "item_evaluacion"
    Descripcion: contiene los items asociados a las competencias (a la tabla clase, mediante relacion clase_id) de los aspectos de cada competencia a evaluar. Tiene un campo de tipo varchar llamad "tipo" que determina el rango de lq respuesta, puede ser "rango1,5" para desplegar 5 campos de tipo check por respuesta, o un "si/no" para un radio buton, o "text" para untexto abierto
    instrucciones: crea la funcionalidad para listar, agregar, modificar y eliminar registros, no debe permitir agregar items si no hay competencias creadas, y debe mostrar los nombres de las competencias y no el id. El campo "tipo" debe ser una lista desplegable con las opciones.
1.4. Cierre de evaluaciones: desde la tabla "evaluacion" se podra cerrar la evaluacion realizada.
2. Estas opciones deben estar en un itme llamado evaluaciones antes del "panel administrativo"
2.1. Tabla Evaluacion: 
    Nombre: "evaluacion"
    Descripcion: contiene los datos de la evaluacion realizada a un trabajador
    instrucciones: crea la funcionalidad para que una vez ingresada la opcion de evaluacion, se muestre primero el listado de trabajadores que dependen del usuario que se autenticó (todos los registros de la tabla trabajador que tienen en el campo "supervidor_id" el id del usuario con el que se ingreso al sistema). Una vez que seleccione al trabajador al que se le va a hacer la evaluacion, se muestre un despliegue con todas las competencias e items o aspectos a evalaur, cada una ordenada por las competencias (campo "orden") y por los items (campo "ordden") con los campos necesarios para registrar el resultado (si es del 1 al 5, si es si/no, si es texto libre). Este despliegue se almacenara en la tabla "evaluacion" y el valor del campo se almacenara en el campo "evaluacion". Si un trabajador es evaluado dos veces, se debe mostrar la fecha en que se realizó la evaluacion, en un campo llamado "fecha", solo puede haber una evaluacion por fecha. Si se desea modificar la evaluación podrá hacerse solo si el campo "estado" esta en false. 



