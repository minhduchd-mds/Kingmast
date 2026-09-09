import type { SensorHealth,SensorState,Severity } from '@kingmast/contracts';

export interface SensorAvailability {
  severity:Severity;
  title:string;
  message:string;
  affected:string[];
  healthy:boolean;
}

function isUnavailable(state:SensorState){return state==='unavailable';}
function isLimited(state:SensorState){return state!=='ok';}

export function sensorAvailability(sensors:SensorHealth,moving:boolean,simulator=false,isVietnamese=false):SensorAvailability{
  const tx=(en:string,vi:string)=>isVietnamese?vi:en;
  if(simulator)return{severity:'safe',title:tx('Demo sensors','Cảm biến mô phỏng'),message:tx('Simulator sensing is active.','Cảm biến mô phỏng đang hoạt động.'),affected:[],healthy:true};
  const affected:string[]=[];
  if(isLimited(sensors.radarFront))affected.push(tx('front radar','radar trước'));
  if(isLimited(sensors.radarRear))affected.push(tx('rear radar','radar sau'));
  if(isLimited(sensors.camera))affected.push(tx('forward camera','camera trước'));
  if(isLimited(sensors.can))affected.push(tx('vehicle CAN','CAN xe'));
  if(isLimited(sensors.gnssImu))affected.push('GNSS / IMU');
  if(isLimited(sensors.ecu))affected.push(tx('safety ECU','ECU an toàn'));
  if(!affected.length)return{severity:'safe',title:tx('Sensors ready','Cảm biến sẵn sàng'),message:tx('Primary sensing inputs report available.','Các đầu vào cảm biến chính đang khả dụng.'),affected,healthy:true};

  const coreUnavailable=isUnavailable(sensors.ecu)||isUnavailable(sensors.can);
  if(coreUnavailable)return{severity:moving?'critical':'caution',title:tx('Vehicle telemetry limited','Telemetry xe bị giới hạn'),message:tx('Safety ECU or vehicle CAN is unavailable. Some on-vehicle warnings may be unavailable; driver observation remains primary.','ECU an toàn hoặc CAN xe không khả dụng. Một số cảnh báo trên xe có thể không hoạt động; quan sát trực tiếp của người lái vẫn là chính.'),affected,healthy:false};

  const forwardUnavailable=isUnavailable(sensors.radarFront)&&isUnavailable(sensors.camera);
  if(forwardUnavailable)return{severity:moving?'critical':'caution',title:tx('Forward sensing unavailable','Cảm biến phía trước không khả dụng'),message:tx('Front radar and forward camera are unavailable. Forward object warnings may be unavailable until sensing recovers.','Radar trước và camera trước không khả dụng. Cảnh báo vật thể phía trước có thể không hoạt động cho tới khi cảm biến phục hồi.'),affected,healthy:false};

  const forwardLimited=isLimited(sensors.radarFront)||isLimited(sensors.camera);
  if(forwardLimited)return{severity:'caution',title:tx('Forward sensing degraded','Cảm biến phía trước suy giảm'),message:tx('Forward sensing redundancy is reduced. Keep extra distance and rely on direct road observation.','Khả năng dự phòng cảm biến phía trước bị giảm. Hãy tăng khoảng cách và dựa vào quan sát trực tiếp mặt đường.'),affected,healthy:false};

  if(isUnavailable(sensors.radarRear))return{severity:'caution',title:tx('Rear awareness limited','Nhận biết phía sau bị giới hạn'),message:tx('Rear radar is unavailable. Blind-spot and rear cross-traffic coverage may be reduced.','Radar sau không khả dụng. Phạm vi điểm mù và phương tiện cắt ngang phía sau có thể bị giảm.'),affected,healthy:false};
  if(isUnavailable(sensors.gnssImu))return{severity:'caution',title:tx('Positioning unavailable','Định vị không khả dụng'),message:tx('GNSS / IMU is unavailable. Route positioning and connected-road relevance may be degraded.','GNSS / IMU không khả dụng. Định vị tuyến và mức liên quan của dữ liệu đường kết nối có thể bị suy giảm.'),affected,healthy:false};

  return{severity:'caution',title:tx('Sensor capability reduced','Khả năng cảm biến bị giảm'),message:isVietnamese?`Đầu vào bị giới hạn: ${affected.join(', ')}. Cảnh báo va chạm chính chỉ duy trì khi các cảm biến bắt buộc còn khả dụng.`:`Limited input: ${affected.join(', ')}. Primary collision warnings remain active only where required sensor inputs are available.`,affected,healthy:false};
}
