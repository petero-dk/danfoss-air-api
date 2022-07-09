# dfair
Danfoss Air node.js application

MAC? 00076804607F 10.10.10.102

ECL kapvej20 000768 05534F SN 118665
ECL anneks   000768 05536B SN 118693 

# multicast listener

# mqtt dependency


#protocol tech
Devices.cs 1529
            // read and set outdoor temp + T2 -> T4
            ReadParameterAndUpdateDataPoint(m_params.GetParameter<short>(1, 820), m_sysStatus.OutdoorTemperature);
            ReadParameterAndUpdateDataPoint(m_params.GetParameter<short>(4, 5235), m_sysStatus.SupplyTemperature);
            ReadParameterAndUpdateDataPoint(m_params.GetParameter<short>(4, 5236), m_sysStatus.ExtractTemperature);
            ReadParameterAndUpdateDataPoint(m_params.GetParameter<short>(4, 5237), m_sysStatus.ExhaustTemperature);

            // relative humidity
            ReadParameter(1, 5232);
            if (m_params.GetValue<byte>(1, 5232) > 0)
                m_sysStatus.RelativeHumidity.SetValue(Convert.ToInt32(Converter.HumidityToDouble(m_params.GetValue<byte>(1, 5232))));
            else
                m_sysStatus.RelativeHumidity.Reset();

            // defrost status
            ReadParameter(1, 5617);
            m_sysStatus.DefrostActive.SetValue(m_params.GetValue<bool>(1, 5617) ? YesNoStatus.Yes : YesNoStatus.No);