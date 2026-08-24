<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title>Leitor de Patrimônio</title>

    <script src="https://unpkg.com/html5-qrcode"></script>

    <style>
        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            padding: 20px;
            font-family: Arial, sans-serif;
            background: #f2f2f2;
        }

        .container {
            max-width: 500px;
            margin: auto;
        }

        h1 {
            text-align: center;
            font-size: 24px;
        }

        #reader {
            width: 100%;
            margin-top: 20px;
            background: white;
            border-radius: 10px;
            overflow: hidden;
        }

        .resultado {
            margin-top: 20px;
            padding: 20px;
            background: white;
            border-radius: 10px;
            text-align: center;
        }

        .resultado small {
            display: block;
            color: #666;
            margin-bottom: 8px;
        }

        #codigo {
            font-size: 32px;
            font-weight: bold;
            word-break: break-all;
        }

        #status {
            text-align: center;
            color: #555;
        }
    </style>
</head>

<body>

    <div class="container">

        <h1>Leitor de Patrimônio</h1>

        <p id="status">
            Aponte a câmera para o código de barras.
        </p>

        <div id="reader"></div>

        <div class="resultado">

            <small>CÓDIGO CAPTURADO</small>

            <div id="codigo">---</div>

        </div>

    </div>

    <script>

        const codigo = document.getElementById("codigo");
        const status = document.getElementById("status");

        let ultimoCodigo = "";

        function sucesso(decodedText, decodedResult) {

            if (decodedText === ultimoCodigo) {
                return;
            }

            ultimoCodigo = decodedText;

            codigo.textContent = decodedText;

            status.textContent = "Código encontrado!";

            console.log("Código:", decodedText);

            // Para a câmera depois de encontrar
            html5QrcodeScanner.clear();

        }

        function erro(errorMessage) {
            // Não fazemos nada.
            // A biblioteca chama isso enquanto procura o código.
        }

        const html5QrcodeScanner = new Html5QrcodeScanner(
            "reader",
            {
                fps: 10,

                qrbox: {
                    width: 300,
                    height: 150
                },

                rememberLastUsedCamera: true,

                supportedScanTypes: [
                    Html5QrcodeScanType.SCAN_TYPE_CAMERA
                ]
            },
            false
        );

        html5QrcodeScanner.render(sucesso, erro);

    </script>

</body>
</html>