from schemas import TeamUpdate

data = TeamUpdate.model_validate({})
print("Parsed empty:", data.model_dump(exclude_unset=True))
print("model_fields_set:", data.model_fields_set)

data2 = TeamUpdate.model_validate({"manager_id": None})
print("Parsed null:", data2.model_dump(exclude_unset=True))
print("model_fields_set2:", data2.model_fields_set)

data3 = TeamUpdate.model_validate({"name": "Test"})
print("Parsed name:", data3.model_dump(exclude_unset=True))
print("model_fields_set3:", data3.model_fields_set)
