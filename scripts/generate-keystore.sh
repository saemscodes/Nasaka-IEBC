#!/bin/bash

# Generate Android keystore for signing
KEYSTORE_PATH="keystore/release.keystore"
KEYSTORE_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 16)
KEYSTORE_ALIAS="nasaka"
KEYSTORE_ALIAS_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 16)

echo "Generating Android keystore..."
echo ""

# Create keystore directory
mkdir -p keystore

# Generate keystore
keytool -genkeypair \
  -v \
  -keystore "$KEYSTORE_PATH" \
  -alias "$KEYSTORE_ALIAS" \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass "$KEYSTORE_PASSWORD" \
  -keypass "$KEYSTORE_ALIAS_PASSWORD" \
  -dname "CN=Nasaka IEBC, OU=CEKA Community, O=Nasaka, L=Nairobi, ST=Nairobi, C=KE"

echo ""
echo "✅ Keystore generated successfully!"
echo ""
echo "🔐 Keystore Info:"
echo "   Path: $KEYSTORE_PATH"
echo "   Alias: $KEYSTORE_ALIAS"
echo "   Validity: 10000 days"
echo ""
echo "⚠️  IMPORTANT SECURITY INFO ⚠️"
echo "Store these values in GitHub Secrets:"
echo ""
echo "KEYSTORE_BASE64=$(base64 -i $KEYSTORE_PATH | tr -d '\n')"
echo "KEYSTORE_PASSWORD=$KEYSTORE_PASSWORD"
echo "KEYSTORE_ALIAS_PASSWORD=$KEYSTORE_ALIAS_PASSWORD"
echo ""
echo "Do NOT commit the keystore file to version control!"