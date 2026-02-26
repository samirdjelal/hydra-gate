#[cfg(target_os = "android")]
use jni::{objects::JClass, sys::jint, JNIEnv, JavaVM};

#[cfg(target_os = "android")]
#[no_mangle]
pub extern "system" fn Java_com_samir_hydragate_HydraVpnService_passFdToRust(
    mut _env: JNIEnv,
    _class: JClass,
    fd: jint,
) {
    println!("HydraGate: Received TUN file descriptor from Android: {}", fd);
    // In a full implementation, this FD would be passed to a
    // packet translation layer like `tun2socks` or `smoltcp`.
}

#[cfg(target_os = "android")]
fn run_on_main_activity<F>(f: F) -> Result<(), String>
where
    F: FnOnce(&mut JNIEnv, &jni::objects::JObject) -> jni::errors::Result<()>,
{
    let ctx = ndk_context::android_context();
    let vm = unsafe { JavaVM::from_raw(ctx.vm().cast()) }
        .map_err(|e| format!("Failed to get JavaVM: {}", e))?;
    
    let mut env = vm
        .attach_current_thread()
        .map_err(|e| format!("Failed to attach thread: {}", e))?;

    let class = env
        .find_class("com/samir/hydragate/MainActivity")
        .map_err(|e| format!("Failed to find MainActivity: {}", e))?;

    let field_id = env.get_static_field_id(&class, "instance", "Lcom/samir/hydragate/MainActivity;")
        .map_err(|e| format!("Failed to get static field: {}", e))?;

    let instance = unsafe {
        env.get_static_field_unchecked(&class, field_id, jni::signature::JavaType::Object("com/samir/hydragate/MainActivity".to_owned()))
            .map_err(|e| format!("Failed to get instance: {}", e))?
            .l()
            .map_err(|e| format!("Instance is not an object: {}", e))?
    };

    if instance.is_null() {
        return Err("MainActivity instance is null".into());
    }

    f(&mut env, &instance).map_err(|e| format!("JNI execution failed: {}", e))?;

    Ok(())
}

#[cfg(target_os = "android")]
pub fn start_vpn() -> Result<(), String> {
    println!("HydraGate: Instructing Android to start VPN");
    run_on_main_activity(|env, instance| {
        env.call_method(instance, "startVpnService", "()V", &[])?;
        Ok(())
    })
}

#[cfg(not(target_os = "android"))]
pub fn start_vpn() -> Result<(), String> {
    Err("VPN Service is only supported on Android".into())
}

#[cfg(target_os = "android")]
pub fn stop_vpn() -> Result<(), String> {
    println!("HydraGate: Instructing Android to stop VPN");
    run_on_main_activity(|env, instance| {
        env.call_method(instance, "stopVpnService", "()V", &[])?;
        Ok(())
    })
}

#[cfg(not(target_os = "android"))]
pub fn stop_vpn() -> Result<(), String> {
    Err("VPN Service is only supported on Android".into())
}

#[cfg(target_os = "android")]
pub fn get_vpn_status() -> Result<bool, String> {
    let mut status = false;
    run_on_main_activity(|env, instance| {
        let res = env.call_method(instance, "isVpnServiceRunning", "()Z", &[])?;
        status = res.z()?;
        Ok(())
    })?;
    Ok(status)
}

#[cfg(not(target_os = "android"))]
pub fn get_vpn_status() -> Result<bool, String> {
    Ok(false)
}
