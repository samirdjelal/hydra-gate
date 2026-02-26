use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use aes_gcm::aead::rand_core::RngCore;
use std::fs;
use std::path::PathBuf;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum CryptoError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Encryption/Decryption error")]
    GcmError,
}

// For MVP, we use a fixed or file-based key.
// In a real app, this should be securely generated and stored in a keychain.
fn get_or_create_key(app_dir: &PathBuf) -> Result<[u8; 32], CryptoError> {
    let key_path = app_dir.join("hydra.key");
    if key_path.exists() {
        let key_bytes = fs::read(&key_path)?;
        let mut key = [0u8; 32];
        let len = std::cmp::min(key_bytes.len(), 32);
        key[..len].copy_from_slice(&key_bytes[..len]);
        Ok(key)
    } else {
        let mut key = [0u8; 32];
        OsRng.fill_bytes(&mut key);
        fs::write(&key_path, key)?;
        Ok(key)
    }
}

pub fn encrypt_proxies(app_dir: &PathBuf, plaintext: &[u8]) -> Result<Vec<u8>, CryptoError> {
    let key = get_or_create_key(app_dir)?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|_| CryptoError::GcmError)?;
    
    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let mut ciphertext = cipher.encrypt(nonce, plaintext).map_err(|_| CryptoError::GcmError)?;
    
    // Prepend nonce to ciphertext
    let mut result = nonce_bytes.to_vec();
    result.append(&mut ciphertext);
    
    Ok(result)
}

pub fn decrypt_proxies(app_dir: &PathBuf, data: &[u8]) -> Result<Vec<u8>, CryptoError> {
    if data.len() < 12 {
        return Err(CryptoError::GcmError);
    }
    let key = get_or_create_key(app_dir)?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|_| CryptoError::GcmError)?;
    
    let nonce = Nonce::from_slice(&data[0..12]);
    let ciphertext = &data[12..];
    
    let plaintext = cipher.decrypt(nonce, ciphertext).map_err(|_| CryptoError::GcmError)?;
    Ok(plaintext)
}
