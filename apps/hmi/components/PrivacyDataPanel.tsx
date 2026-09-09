'use client';

import { Database, History, LockKeyhole, ShieldCheck, Trash2, UploadCloud } from 'lucide-react';
import { useState } from 'react';
import { usePrivacyControls } from '../lib/use-privacy-controls';
import { useI18n } from '../lib/i18n';

function PrivacySwitch({label,description,checked,onChange}:{label:string;description:string;checked:boolean;onChange:(value:boolean)=>void}){return <div className="privacyRow"><span><strong>{label}</strong><small>{description}</small></span><button type="button" role="switch" aria-label={label} aria-checked={checked} className={`appleSwitch ${checked?'isOn':''}`} onClick={()=>onChange(!checked)}><span/></button></div>;}

export default function PrivacyDataPanel(){
  const privacy=usePrivacyControls();const{isVietnamese}=useI18n();
  const[confirmClear,setConfirmClear]=useState(false);
  return <section className="systemCard" data-testid="privacy-data-controls">
    <div className="systemCardHeader"><span><LockKeyhole/><span><strong>{isVietnamese?'Quyền riêng tư & dữ liệu':'Privacy & data controls'}</strong><small>{isVietnamese?'Mặc định tối thiểu dữ liệu · tác vụ xóa cần xác nhận':'Data minimization by default · destructive actions require confirmation'}</small></span></span><b>{isVietnamese?'HMI cục bộ':'Local HMI'}</b></div>
    <div className="privacyGrid">
      <PrivacySwitch label={isVietnamese?'Lưu tóm tắt chuyến đi':'Retain trip summaries'} description={isVietnamese?'Lưu metadata tóm tắt chuyến đi trên HMI để xem lại.':'Store trip summary metadata on this HMI for later review.'} checked={privacy.preferences.retainTripSummaries} onChange={(value)=>privacy.updatePreferences({retainTripSummaries:value})}/>
      <PrivacySwitch label={isVietnamese?'Lịch sử vị trí':'Location history'} description={isVietnamese?'Cho phép lưu điểm đến gần đây và lịch sử tuyến trên HMI.':'Allow recent destination and route history to remain on this HMI.'} checked={privacy.preferences.locationHistory} onChange={(value)=>privacy.updatePreferences({locationHistory:value})}/>
      <PrivacySwitch label={isVietnamese?'Tải metadata chẩn đoán':'Diagnostic upload'} description={isVietnamese?'Cho phép tải metadata chẩn đoán khi backend được ủy quyền đã cấu hình. Mặc định tắt.':'Allow diagnostic metadata upload when an authorized backend is configured. Off by default.'} checked={privacy.preferences.diagnosticUpload} onChange={(value)=>privacy.updatePreferences({diagnosticUpload:value})}/>
    </div>
    <div className="privacyInventory"><div><Database/><span><strong>{isVietnamese?'Lưu cục bộ':'Stored locally'}</strong><small>{isVietnamese?'Tùy chọn HMI, cache tuyến tùy chọn, điểm đến gần đây và hồ sơ người lái.':'HMI preferences, optional route cache, recent destinations and driver profile.'}</small></span></div><div><ShieldCheck/><span><strong>{isVietnamese?'Web UI không lưu':'Not stored by web UI'}</strong><small>{isVietnamese?'Mật khẩu Wi‑Fi và gói firmware tùy ý không được KINGMAST web UI lưu.':'Wi-Fi passwords and arbitrary firmware packages are not persisted by KINGMAST web UI.'}</small></span></div><div><UploadCloud/><span><strong>{isVietnamese?'Không tự tải lên':'No silent upload'}</strong><small>{isVietnamese?'Tải chẩn đoán vẫn tắt nếu người lái chưa bật và chưa có backend được ủy quyền.':'Diagnostic upload remains disabled unless the driver enables it and an authorized backend exists.'}</small></span></div></div>
    <div className="privacyActions"><button type="button" onClick={()=>setConfirmClear(true)}><History/> {isVietnamese?'Xóa lịch sử dẫn đường':'Clear navigation history'}</button>{privacy.historyClearedAtMs?<span role="status"><Trash2/> {isVietnamese?'Đã xóa lịch sử':'History cleared'}</span>:null}</div>
    {confirmClear?<div className="privacyConfirm" role="group" aria-label={isVietnamese?'Xác nhận xóa lịch sử dẫn đường':'Confirm clearing navigation history'}><Trash2/><span><strong>{isVietnamese?'Xóa tuyến đã cache và điểm đến gần đây?':'Clear cached routes and recent destinations?'}</strong><small>{isVietnamese?'Không thể hoàn tác. Hồ sơ người lái, tùy chọn an toàn và thiết lập ban đầu vẫn được giữ.':'This action cannot be undone. Driver profile, safety preferences and first-run setup remain intact.'}</small></span><div><button type="button" onClick={()=>setConfirmClear(false)}>{isVietnamese?'Hủy':'Cancel'}</button><button type="button" className="systemDestructive" onClick={()=>{privacy.clearNavigationHistory();setConfirmClear(false);}}>{isVietnamese?'Xóa lịch sử':'Clear history'}</button></div></div>:null}
    <p className="systemFootnote">{isVietnamese?'v0.0.6 chưa kết nối tài khoản cloud nên màn này không giả lập tính năng xóa tài khoản. Chỉ bổ sung xóa cấp tài khoản khi dịch vụ định danh/backend thực sự tồn tại.':'No cloud account is connected in v0.0.6, so this screen does not pretend to offer account deletion. Account-level deletion must be added only when identity/backend services exist.'}</p>
  </section>;
}
