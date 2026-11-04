# Assinatura própria do Android

A partir da versão 3.5.0, os lançamentos exigem os quatro segredos ANDROID_KEYSTORE_BASE64, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS e ANDROID_KEY_PASSWORD. A chave privada e a senha não são versionadas. A impressão SHA-256 pública do certificado está em android-signing.sha256.

A compilação verifica a assinatura do APK, compara o certificado com a impressão esperada, rejeita depuração habilitada e confere a lista de permissões. A ausência de um segredo encerra a publicação; não há substituição automática por chave de testes. A geração e o uso dessa chave para distribuir APKs diretamente são gratuitos.

## Migração do APK de testes

Android não instala por cima uma atualização assinada com uma chave diferente. Antes de trocar: abra o aplicativo antigo, conecte à internet e confira em Sincronização que não há operações pendentes ou com erro. Confirme no site que os dados chegaram à conta. Exporte os dados se desejar uma cópia adicional. Depois desinstale o APK antigo, instale o novo e entre na mesma conta. Preferências exclusivamente locais podem precisar ser configuradas novamente. Não desinstale com alterações ainda não sincronizadas.

As futuras versões assinadas com esta chave podem atualizar esta instalação normalmente. Guarde a cópia da chave em local seguro: perder a chave impede manter a mesma identidade de atualização na distribuição direta.

A chave de distribuição direta e o pacote AAB não equivalem à publicação na Google Play, que possui cadastro e regras próprios. Esta entrega publica o APK e o AAB no GitHub Releases.

Referência: https://developer.android.com/studio/publish/app-signing
